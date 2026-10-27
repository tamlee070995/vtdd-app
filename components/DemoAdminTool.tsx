"use client";

import { useEffect, useRef, useState } from "react";
import { Editor } from "@tinymce/tinymce-react";
import type { Editor as TinyEditor } from "tinymce";
import { emptyDemoGuide, normalizeDemoGuide, type DemoBrand, type DemoGuide, type DemoFeatures, type DemoMedia } from "@/lib/demo-content";
import DemoGuideContent from "./DemoGuideContent";
import styles from "./Demo.module.css";
import UiNotice from "./UiNotice";
import { clientErrorMessage, requestJson } from "@/lib/client-request";

const sortBrands = (brands: DemoBrand[]) => [...brands].sort((a,b) => a.order - b.order || a.draft.name.localeCompare(b.draft.name, "vi"));
type SaveAction = "CREATE" | "SAVE_DRAFT" | "PUBLISH" | "UNPUBLISH" | "SET_VISIBILITY" | "SET_ORDER";
type Props = { showToast: (type: "success" | "error", message: string) => void };
export default function DemoAdminTool({ showToast }: Props) {
  const [brands, setBrands] = useState<DemoBrand[]>([]);
  const [selected, setSelected] = useState("");
  const [guide, setGuide] = useState<DemoGuide>(emptyDemoGuide(""));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [preview, setPreview] = useState<DemoGuide | null>(null);
  const [order, setOrder] = useState("0");
  const editor = useRef<TinyEditor | null>(null);
  const current = brands.find(brand => brand.id === selected);

  function choose(brand: DemoBrand) {
    if (brand.id !== selected) editor.current = null;
    setSelected(brand.id); setGuide(structuredClone(brand.draft)); setOrder(String(brand.order)); setDirty(false); setPreview(null); setError("");
  }
  async function load(signal?: AbortSignal) {
    setLoading(true); setError("");
    try {
      const json = await requestJson<{ success: boolean; brands: DemoBrand[] }>("/api/admin/demo", { signal });
      const next = sortBrands(json.brands || []);
      setBrands(next); if (next[0]) choose(next[0]);
    } catch (err) { if (!signal?.aborted) setError(clientErrorMessage(err, "Không tải được danh mục hãng.")); }
    finally { if (!signal?.aborted) setLoading(false); }
  }
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
    // Load the catalog once when this module opens; explicit refresh handles later changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function change(patch: Partial<DemoGuide>) { setGuide(value => ({...value,...patch})); setDirty(true); setPreview(null); }
  function canLeave() { return !dirty || window.confirm("Nội dung chưa lưu. Bạn muốn bỏ thay đổi để tiếp tục?"); }

  async function upload(file: File) {
    if (file.size > 4 * 1024 * 1024) throw new Error("Tệp tối đa 4MB. Với tệp lớn hơn, hãy dán liên kết HTTPS.");
    const form = new FormData(); form.append("file", file);
    const res = await fetch("/api/admin/demo/upload", { method:"POST", body:form });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || "Không tải được tệp.");
    return json as { url: string; kind: "image" | "file"; name: string };
  }
  async function addUpload(file: File | undefined, kind: "images" | "files") {
    if (!file) return;
    setBusy("upload"); setError("");
    try {
      const result = await upload(file);
      if (kind === "images" && result.kind !== "image") throw new Error("Vui lòng chọn ảnh hợp lệ.");
      setGuide(value => ({ ...value, [kind]: [...value[kind], { url:result.url, label:file.name }], features:{...value.features,[kind]:true} }));
      setDirty(true); setPreview(null);
    } catch(err) { setError(err instanceof Error ? err.message : "Không tải được tệp."); }
    finally { setBusy(""); }
  }
  async function finalGuide() {
    if (editor.current) {
      await editor.current.uploadImages();
      return normalizeDemoGuide({...guide, body:editor.current.getContent()});
    }
    return normalizeDemoGuide(guide);
  }
  async function save(action: SaveAction, extra: Record<string, unknown> = {}) {
    if (busy || (!current && action !== "CREATE")) return;
    setBusy(action); setError(""); setMessage("");
    try {
      const content = action === "SAVE_DRAFT" || action === "PUBLISH" ? await finalGuide() : undefined;
      const res = await fetch("/api/admin/demo", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ action, id:current?.id, revision:current?.revision, guide:content, ...extra }) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Không lưu được nội dung.");
      const updated = json.brand as DemoBrand;
      setBrands(previous => sortBrands(action === "CREATE" ? [...previous,updated] : previous.map(brand => brand.id === updated.id ? updated : brand)));
      if (["CREATE", "SAVE_DRAFT", "PUBLISH"].includes(action)) {
        if (action === "CREATE") choose(updated);
        else { setGuide(structuredClone(updated.draft)); setDirty(false); setPreview(null); }
      }
      if (action === "CREATE") { setAdding(false); setNewName(""); }
      if (action === "SET_ORDER") setOrder(String(updated.order));
      const success = action === "PUBLISH" ? "Đã xuất bản hướng dẫn lên trang hãng." : action === "CREATE" ? "Đã tạo hãng ở trạng thái bản nháp." : action === "SAVE_DRAFT" ? "Đã lưu nháp. Nội dung đang hiển thị được giữ nguyên." : action === "UNPUBLISH" ? "Đã ngừng xuất bản trang hãng." : "Đã cập nhật danh mục hãng.";
      setMessage(success); showToast("success",success);
    } catch(err) { setError(err instanceof Error ? err.message : "Không lưu được nội dung."); }
    finally { setBusy(""); }
  }
  async function showPreview() {
    setBusy("preview"); setError("");
    try { setPreview(await finalGuide()); } catch(err) { setError(err instanceof Error ? err.message : "Không xem trước được nội dung."); }
    finally { setBusy(""); }
  }
  function updateMedia(kind: "images" | "files", index: number, patch: Partial<DemoMedia>) {
    change({[kind]:guide[kind].map((item,i) => i===index ? {...item,...patch} : item)});
  }
  function mediaFields(kind: "images" | "files") {
    return <>
      {guide[kind].map((item,index) => <div key={index}>
        <div className={styles.mediaRow}>
          <label className={styles.field}>{kind==="images" ? "Liên kết ảnh" : "Liên kết tải về"}<input type="url" value={item.url} onChange={event => updateMedia(kind,index,{url:event.target.value})} disabled={!!busy} placeholder="https://..." /></label>
          <label className={styles.field}>{kind==="images" ? "Chú thích ảnh" : "Tên tệp"}<input value={item.label} maxLength={160} onChange={event => updateMedia(kind,index,{label:event.target.value})} disabled={!!busy} /></label>
          <button className={styles.button} type="button" onClick={() => change({[kind]:guide[kind].filter((_,i)=>i!==index)})} disabled={!!busy} aria-label={`Bỏ ${kind==="images" ? "ảnh" : "tệp"} ${index+1}`}>Bỏ</button>
        </div>
      </div>)}
      <div className={styles.actions}>
        <button className={styles.button} type="button" onClick={() => change({[kind]:[...guide[kind],{url:"",label:""}]})} disabled={!!busy || guide[kind].length >= (kind==="images" ? 20 : 15)}>+ Thêm liên kết {kind==="images" ? "ảnh" : "tệp"}</button>
        <label className={styles.upload}>Tải {kind==="images" ? "ảnh" : "tệp"} lên<input type="file" accept={kind==="images" ? "image/png,image/jpeg,image/webp,image/gif" : ".pdf,.zip,.apk,.docx,.xlsx"} disabled={!!busy || guide[kind].length >= (kind==="images" ? 20 : 15)} onChange={event => { const file=event.target.files?.[0]; event.target.value=""; void addUpload(file,kind); }} /></label>
      </div>
    </>;
  }

  return <section className={styles.admin}>
    <div className={styles.adminHeading}><div><h2>Hãng &amp; hướng dẫn Gỡ Demo</h2><p>Thêm hãng, soạn hướng dẫn riêng và chủ động xuất bản.</p></div><div className={styles.actions}>
      <a className={styles.publicLink} href="/p/demo" target="_blank" rel="noopener noreferrer">Mở trang Gỡ Demo ↗</a>
      <button className={styles.button} disabled={!!busy || loading} type="button" onClick={() => { if(canLeave())void load(); }}>Tải lại</button>
      <button className={`${styles.button} ${styles.primary}`} disabled={!!busy || loading} type="button" onClick={() => setAdding(value=>!value)}>+ Thêm hãng</button>
    </div></div>
    {error ? <UiNotice busy={!!busy || loading} onRetry={() => { if (canLeave()) void load(); }} retryLabel={brands.length ? "Tải lại trạng thái" : "Thử lại"}>{error}{dirty && <p>Nội dung chưa lưu vẫn còn trong trình soạn thảo.</p>}</UiNotice> : null}
    {message ? <UiNotice tone="success">{message}</UiNotice> : null}
    {busy ? <UiNotice tone="loading">{busy === "upload" ? "Đang tải tệp…" : busy === "preview" ? "Đang chuẩn bị bản xem trước…" : "Đang lưu thay đổi. Vui lòng chờ kết quả…"}</UiNotice> : null}
    {adding ? <form className={styles.formPanel} onSubmit={event => { event.preventDefault(); if(canLeave())void save("CREATE",{name:newName}); }}>
      <label className={styles.field}>Tên hãng mới<input required maxLength={60} value={newName} placeholder="Ví dụ: Samsung" onChange={event=>setNewName(event.target.value)} disabled={!!busy} /></label>
      <div className={styles.actions}><button className={`${styles.button} ${styles.publish}`} type="submit" disabled={!!busy}>Tạo bản nháp</button><button className={styles.button} type="button" disabled={!!busy} onClick={()=>setAdding(false)}>Hủy</button></div>
    </form> : null}
    {loading ? <p className={styles.loading}>Đang tải danh mục hãng...</p> : current ? <div className={styles.workspace}>
      <aside className={styles.sidebar} aria-label="Danh sách hãng">{brands.map(brand=><button className={`${styles.sideButton} ${selected===brand.id ? styles.selected : ""}`} type="button" key={brand.id} disabled={!!busy} onClick={()=>{if(brand.id!==selected && canLeave())choose(brand);}}><b>{brand.draft.name}</b><small>{!brand.published ? "Bản nháp" : brand.visible ? "Đang hiển thị" : "Đang ẩn"}</small></button>)}</aside>
      <section className={styles.editor}>
        <div className={styles.topLine}><h3>Chỉnh sửa {current.draft.name}</h3><span className={styles.status}>{dirty ? "Có thay đổi chưa lưu" : current.updatedAt ? `Lưu: ${new Date(current.updatedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}` : "Chưa có nội dung"}</span></div>
        {current.published && current.visible ? <p><a className={styles.publicLink} href={`/p/demo/${current.slug}`} target="_blank" rel="noopener noreferrer">Mở trang hãng ↗</a></p> : null}
        <div className={styles.fields}>
          <div className={styles.twoFields}><label className={styles.field}>Tên hãng<input value={guide.name} maxLength={60} disabled={!!busy} onChange={event=>change({name:event.target.value})} /></label><label className={styles.field}>Tiêu đề trang<input value={guide.title} maxLength={160} disabled={!!busy} onChange={event=>change({title:event.target.value})} /></label></div>
          <label className={styles.field}>Mô tả ngắn<textarea rows={2} maxLength={400} value={guide.summary} disabled={!!busy} onChange={event=>change({summary:event.target.value})} /></label>
        </div>
        <p className={styles.sectionTitle}>Các phần hiển thị trên trang hãng</p><div className={styles.checks}>{([["text","Nội dung hướng dẫn"],["images","Ảnh minh họa"],["video","Video hướng dẫn"],["files","Tệp / công cụ tải về"]] as [keyof DemoFeatures,string][]).map(([key,label])=><label className={styles.check} key={key}><input type="checkbox" checked={guide.features[key]} disabled={!!busy} onChange={event=>change({features:{...guide.features,[key]:event.target.checked}})} />{label}</label>)}</div>
        <p className={styles.sectionTitle}>Nội dung hướng dẫn</p><p className={styles.note}>Dùng tiêu đề và danh sách để chia các bước. Tắt “Nội dung hướng dẫn” sẽ ẩn phần này trên trang hãng.</p>
        <Editor key={selected} tinymceScriptSrc="/tinymce/tinymce.min.js" licenseKey="gpl" disabled={!!busy} value={guide.body} onInit={(_event,instance)=>{editor.current=instance;}} onEditorChange={value=>{if(value!==guide.body)change({body:value});}} init={{
          height:400, menubar:"edit insert format table", branding:true, promotion:false, convert_urls:false, relative_urls:false, remove_script_host:false,
          automatic_uploads:true, paste_data_images:true, plugins:"lists link image table code fullscreen",
          toolbar:"undo redo | blocks | bold italic underline | bullist numlist | link image table | code fullscreen",
          images_upload_handler:async blobInfo=>(await upload(new File([blobInfo.blob()],blobInfo.filename(),{type:blobInfo.blob().type}))).url,
          content_css: ["default", "/fonts/roboto/roboto.css"],
          content_style:"body{font-family:Roboto,Arial,sans-serif;font-size:15px;line-height:1.7;color:#07111f}img{max-width:100%;height:auto}"
        }} />
        <p className={styles.sectionTitle}>Ảnh minh họa</p>{mediaFields("images")}
        <p className={styles.sectionTitle}>Video hướng dẫn</p><label className={styles.field}>Liên kết video<input type="url" value={guide.videoUrl} disabled={!!busy} onChange={event=>change({videoUrl:event.target.value})} placeholder="Liên kết YouTube, Vimeo hoặc tệp MP4 / WebM" /></label>
        <p className={styles.sectionTitle}>Tài liệu / công cụ tải về</p>{mediaFields("files")}<p className={styles.note}>Tải lên tối đa 4MB mỗi tệp. Với video hoặc tệp lớn hơn, dán liên kết HTTPS.</p>
        <p className={styles.sectionTitle}>Quản lý hiển thị</p><div className={styles.actions}>
          <button className={styles.button} disabled={!!busy} type="button" onClick={()=>void save("SET_VISIBILITY",{visible:!current.visible})}>{current.visible ? "Ẩn hãng khỏi danh mục" : "Hiện hãng trong danh mục"}</button>
          {current.published ? <button className={styles.button} disabled={!!busy} type="button" onClick={()=>void save("UNPUBLISH")}>Ngừng xuất bản</button> : null}
        </div>
        <div className={styles.mediaRow}><label className={styles.field}>Thứ tự hiển thị<input type="number" min={0} max={9999} value={order} disabled={!!busy} onChange={event=>setOrder(event.target.value)} /></label><p className={styles.note}>Số nhỏ hơn đứng trước.</p><button className={styles.button} type="button" disabled={!!busy} onClick={()=>void save("SET_ORDER",{order:Number(order)})}>Lưu thứ tự</button></div>
        <div className={styles.footerActions}><button className={styles.button} type="button" disabled={!!busy} onClick={()=>void save("SAVE_DRAFT")}>{busy==="SAVE_DRAFT" ? "Đang lưu..." : "Lưu nháp"}</button><button className={styles.button} type="button" disabled={!!busy} onClick={()=>void showPreview()}>Xem trước</button><button className={`${styles.button} ${styles.publish}`} type="button" disabled={!!busy} onClick={()=>void save("PUBLISH")}>{busy==="PUBLISH" ? "Đang xuất bản..." : "Xuất bản"}</button></div>
        {preview ? <section className={styles.preview} aria-label="Bản xem trước"><p className={styles.kicker}>BẢN NHÁP · CHƯA XUẤT BẢN</p><h2>{preview.title}</h2><p className={styles.summary}>{preview.summary}</p><DemoGuideContent guide={preview} /></section> : null}
      </section>
    </div> : null}
  </section>;
}
