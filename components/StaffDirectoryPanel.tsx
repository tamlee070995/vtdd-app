"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import PasswordInput from "./PasswordInput";
import UiFeedbackDialog from "./UiFeedbackDialog";
import { clientErrorMessage, requestJson } from "@/lib/client-request";
import { parseNewStaffImport, validateNewStaffRows, type NewStaffInput } from "@/lib/staff-import";
import styles from "./StaffDirectoryPanel.module.css";

type Staff = { maNV: string; staffName: string; maST: string; storeName: string; status: string; permission: "" | "admin" | "mod"; needSetup: string; resetOtpCount: string; modulePermissions: string; rowNumber: number; gmail: string; department: string };
type Meta = { page: number; pages: number; total: number; summary: { total: number; active: number; standby: number; needSetup: number } };
type Preview = { token: string; count: number; skippedSelf: boolean; expiresAt: number; staff: { maNV: string; staffName: string; role: string; status: string }[] };
const roleName = (role: string) => role === "admin" ? "Admin" : role === "mod" ? "Mod" : "Nhân viên";
function StaffDialog({ title, busy, onClose, children }: { title: string; busy: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const node = ref.current, previous = document.activeElement; node?.showModal(); return () => { node?.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true }); }; }, []);
  return <dialog ref={ref} className={styles.dialog} aria-label={title} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}><header><h2>{title}</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Đóng">×</button></header>{children}</dialog>;
}
export default function StaffDirectoryPanel({ staff, meta, loading, busy: parentBusy, isAdmin, actorCode, canManage, canDelete, canReset, canResetOtp, search, onSearchChange, onSearch, status, onStatusChange, role, onRoleChange, onPage, onReload, onAction, onDelete, onImportStandby, onBulkStandby }: {
  staff: Staff[]; meta: Meta; loading: boolean; busy: boolean; isAdmin: boolean; actorCode: string;
  canManage: boolean; canDelete: boolean; canReset: boolean; canResetOtp: boolean;
  search: string; onSearchChange: (value: string) => void; onSearch: () => void; status: string; onStatusChange: (value: string) => void; role: string; onRoleChange: (value: string) => void;
  onPage: (page: number) => void; onReload: () => Promise<void>; onAction: (action: "ACTIVE" | "STANDBY" | "RESET_SECURITY" | "RESET_OTP_COUNT", code: string) => void; onDelete: (item: Staff) => void; onImportStandby: () => void; onBulkStandby: () => void;
}) {
  const [kind, setKind] = useState<"one" | "many" | "delete" | null>(null);
  const [one, setOne] = useState({ maNV: "", staffName: "", maST: "" });
  const [text, setText] = useState("");
  const [rows, setRows] = useState<NewStaffInput[]>([]);
  const [password, setPassword] = useState("");
  const [newStatus, setNewStatus] = useState("Standby");
  const [roles, setRoles] = useState<string[]>(["user"]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [working, setWorking] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "loading" | "success" | "error"; text: string } | null>(null);
  const disabled = working || parentBusy;
  function close() { setKind(null); setPassword(""); setAdminPassword(""); setPreview(null); setConfirmation(""); }
  function open(next: "one" | "many" | "delete") { close(); setRows([]); setText(""); setOne({maNV:"",staffName:"",maST:""}); setNewStatus("Standby"); setRoles(["user"]); setKind(next); }
  function readRows(value: string) {
    try { const parsed = parseNewStaffImport(value); setRows(parsed); setFeedback({tone:"success",text:`Đã đọc ${parsed.length} nhân viên. Xin xem danh sách rồi bấm Thêm nhân viên.`}); }
    catch (error) { setRows([]); setFeedback({tone:"error",text:clientErrorMessage(error,"Chưa đọc được danh sách.")}); }
  }
  async function readFile(file: File | undefined) {
    if (!file) return;
    try {
      if (!/\.(csv|tsv|txt)$/i.test(file.name)) throw new Error("Xin lưu Excel thành CSV UTF-8 trước khi tải lên.");
      if (file.size > 1_000_000) throw new Error("Tệp tối đa 1 MB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const encoding = bytes[0] === 255 && bytes[1] === 254 ? "utf-16le" : bytes[0] === 254 && bytes[1] === 255 ? "utf-16be" : "utf-8";
      const value = new TextDecoder(encoding).decode(bytes); setText(value); readRows(value);
    } catch (error) { setRows([]); setFeedback({tone:"error",text:clientErrorMessage(error,"Chưa đọc được tệp.")}); }
  }
  function downloadSample() {
    const url = URL.createObjectURL(new Blob(["\uFEFFMã nhân viên,Tên nhân viên,Mã siêu thị\r\n100123,Nguyễn Văn An,001\r\n100456,Trần Văn Bình,002\r\n"],{type:"text/csv;charset=utf-8"}));
    const link = document.createElement("a"); link.href=url; link.download="mau-them-nhan-vien.csv"; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function downloadDeletionPreview() {
    if (!preview) return;
    const cell = (value: string) => '"' + value.replaceAll('"','""').replace(/^[=+@-]/,"'$&") + '"';
    const csv = "\uFEFFMã nhân viên,Họ tên,Nhóm quyền,Trạng thái\r\n" + preview.staff.map(row=>[row.maNV,row.staffName,roleName(row.role),row.status].map(cell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    const link = document.createElement("a"); link.href=url; link.download="danh-sach-sap-xoa.csv"; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function create() {
    let entries;
    try { entries = kind === "one" ? validateNewStaffRows([one]) : rows; if (!entries.length) throw new Error("Xin đọc danh sách trước."); if(password.trim().length<6)throw new Error("Mật khẩu tạm cần ít nhất 6 ký tự."); }
    catch(error){setFeedback({tone:"error",text:clientErrorMessage(error,"Xin kiểm tra thông tin.")});return;}
    setWorking(true);setFeedback({tone:"loading",text:"Đang thêm nhân viên…"});
    try {
      const result = await requestJson<{message:string;result:{created:string[];skipped:string[]}}>("/api/admin/staff",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"CREATE_STAFF",staff:entries,temporaryPassword:password,status:newStatus})},120_000);
      close(); setFeedback({tone:"success",text:result.message+(result.result.skipped.length?`\nMã đã có: ${result.result.skipped.slice(0,30).join(", ")}.`:"")}); await onReload();
    } catch(error){setFeedback({tone:"error",text:clientErrorMessage(error,"Chưa xác nhận được kết quả. Xin kiểm tra danh sách trước khi thử lại.")});}
    finally{setWorking(false);}
  }
  async function loadPreview() {
    setWorking(true);setFeedback({tone:"loading",text:"Đang đọc danh sách cần xóa…"});
    try { const result=await requestJson<{success:boolean;preview:Preview}>("/api/admin/staff",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"PREVIEW_DELETE_STAFF",roles})},120_000);setPreview(result.preview);setConfirmation("");setAdminPassword("");setFeedback(null); }
    catch(error){setFeedback({tone:"error",text:clientErrorMessage(error,"Chưa đọc được danh sách cần xóa.")});}
    finally{setWorking(false);}
  }
  async function removeGroup() {
    if(!preview || confirmation !== `XÓA ${preview.count}`)return;
    setWorking(true);setFeedback({tone:"loading",text:"Đang xóa các tài khoản đã xác nhận…"});
    try {
      const result=await requestJson<{message:string;result:{failed:string[];unprocessed:string[]}}>("/api/admin/staff",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"DELETE_STAFF_GROUP",token:preview.token,adminPassword})},120_000);
      const pending=[...result.result.failed,...result.result.unprocessed];close();setFeedback({tone:pending.length?"error":"success",text:result.message+(pending.length?`\nChưa xử lý: ${pending.slice(0,30).join(", ")}. Xin xem trước lại trước khi tiếp tục.`:"")});await onReload();
    }catch(error){setPreview(null);setAdminPassword("");setFeedback({tone:"error",text:clientErrorMessage(error,"Chưa xác nhận được kết quả. Xin xem lại danh sách trước khi thử lại.")});}
    finally{setWorking(false);}
  }
  return <>
    <section className={styles.panel} aria-label="Danh sách nhân viên">
      <div className={styles.heading}><h2>Nhân viên</h2><button type="button" disabled={disabled||loading} onClick={()=>void onReload()}>Tải lại danh sách</button></div>
      <div className={styles.stats}><span>Tổng <b>{meta.summary.total}</b></span><span>Active <b>{meta.summary.active}</b></span><span>Standby <b>{meta.summary.standby}</b></span><span>Cần cập nhật bảo mật <b>{meta.summary.needSetup}</b></span></div>
      {isAdmin && <div className={styles.toolbar}><button type="button" disabled={disabled} onClick={()=>open("one")}>Thêm một nhân viên</button><button type="button" disabled={disabled} onClick={()=>open("many")}>Thêm nhiều nhân viên</button><button type="button" className={styles.danger} disabled={disabled} onClick={()=>open("delete")}>Xóa theo nhóm quyền</button><button type="button" disabled={disabled} onClick={onImportStandby}>Import Standby</button><button type="button" disabled={disabled} onClick={onBulkStandby}>Standby theo nhóm</button></div>}
      <form className={styles.filters} onSubmit={event=>{event.preventDefault();onSearch();}}><label>Tìm nhân viên<input value={search} onChange={event=>onSearchChange(event.target.value)} placeholder="Mã nhân viên, họ tên, siêu thị…" /></label><label>Trạng thái<select value={status} onChange={event=>onStatusChange(event.target.value)}><option value="ALL">Tất cả trạng thái</option><option>Active</option><option>Standby</option></select></label><label>Nhóm quyền<select value={role} onChange={event=>onRoleChange(event.target.value)}><option value="ALL">Tất cả nhóm quyền</option><option value="admin">Admin</option><option value="mod">Mod</option><option value="user">Nhân viên</option></select></label><button type="submit" disabled={disabled||loading}>Tìm</button></form>
      {loading ? <p role="status">Đang tải danh sách…</p> : !staff.length ? <p>Chưa có nhân viên phù hợp.</p> : <div className={styles.list}>{staff.map(item=>{
        const protectedAdmin=!isAdmin && item.permission === "admin", self=item.maNV===actorCode;
        return <article className={styles.card} key={item.maNV}><div className={styles.cardHeading}><div><h3>{item.staffName||"Chưa có tên"}</h3><p>NV {item.maNV} · ST {item.maST||"—"}{item.storeName?` · ${item.storeName}`:""}</p></div><span className={item.status === "Active" ? styles.active : styles.standby}>{item.status||"Standby"}</span></div><div className={styles.details}><span>{roleName(item.permission)}</span><span>OTP: {item.resetOtpCount||"0"}</span>{item.needSetup === "1" && <span>Cần cập nhật bảo mật</span>}{self && <span>Tài khoản đang dùng</span>}</div><div className={styles.actions}>
          {canManage && !protectedAdmin && <button type="button" disabled={disabled||self} onClick={()=>onAction(item.status === "Active" ? "STANDBY" : "ACTIVE",item.maNV)}>{item.status === "Active" ? "Chuyển Standby" : "Active"}</button>}
          {canReset && !protectedAdmin && <button type="button" disabled={disabled||self} onClick={()=>{if(window.confirm(`Reset bảo mật NV ${item.maNV}? Nhân viên phải cập nhật lại bảo mật khi đăng nhập.`))onAction("RESET_SECURITY",item.maNV);}}>Reset bảo mật</button>}
          {canResetOtp && !protectedAdmin && <button type="button" disabled={disabled} onClick={()=>onAction("RESET_OTP_COUNT",item.maNV)}>Reset lượt OTP</button>}
          {canDelete && !protectedAdmin && <button type="button" className={styles.danger} disabled={disabled||self} onClick={()=>onDelete(item)}>Xóa</button>}
        </div></article>;
      })}</div>}
      <div className={styles.pagination}><button type="button" disabled={disabled||loading||meta.page<=1} onClick={()=>onPage(meta.page-1)}>Trang trước</button><span>{meta.total} tài khoản · {meta.page}/{meta.pages}</span><button type="button" disabled={disabled||loading||meta.page>=meta.pages} onClick={()=>onPage(meta.page+1)}>Trang sau</button></div>
    </section>
    {kind && <StaffDialog title={kind==="one"?"Thêm một nhân viên":kind==="many"?"Thêm nhiều nhân viên":"Xóa theo nhóm quyền"} busy={working} onClose={close}>
      {kind !== "delete" ? <>
        {kind === "one" ? <div className={styles.fields}><label>Mã nhân viên<input value={one.maNV} inputMode="numeric" maxLength={20} disabled={working} onChange={e=>setOne({...one,maNV:e.target.value})}/></label><label>Họ tên<input value={one.staffName} maxLength={120} disabled={working} onChange={e=>setOne({...one,staffName:e.target.value})}/></label><label>Mã siêu thị (nếu có)<input value={one.maST} inputMode="numeric" maxLength={20} disabled={working} onChange={e=>setOne({...one,maST:e.target.value})}/></label></div> : <>
          <p>CSV/TSV hoặc dán từ Excel: mã nhân viên, tên nhân viên, mã siêu thị (nếu có). Tối đa 200 người mỗi lần.</p><div className={styles.toolbar}><button type="button" disabled={working} onClick={downloadSample}>Tải mẫu CSV</button><label className={styles.file}>Chọn tệp<input type="file" accept=".csv,.tsv,.txt" disabled={working} onChange={e=>void readFile(e.target.files?.[0])}/></label></div><label>Danh sách nhân viên<textarea rows={5} value={text} disabled={working} placeholder={"Mã nhân viên\tTên nhân viên\tMã siêu thị\n100123\tNguyễn Văn An\t001"} onChange={e=>{setText(e.target.value);setRows([]);}}/></label><button type="button" disabled={working||!text.trim()} onClick={()=>readRows(text)}>Đọc danh sách</button>
          {rows.length>0 && <div className={styles.preview} aria-label="Nhân viên sắp thêm"><b>{rows.length} nhân viên sắp thêm</b>{rows.map(row=><p key={row.maNV}>{row.maNV} · {row.staffName}{row.maST?` · ST ${row.maST}`:""}</p>)}</div>}
        </>}
        <label>Mật khẩu tạm<PasswordInput value={password} maxLength={128} disabled={working} autoComplete="new-password" onChange={e=>setPassword(e.target.value)} placeholder="Ít nhất 6 ký tự"/></label><label>Trạng thái ban đầu<select value={newStatus} disabled={working} onChange={e=>setNewStatus(e.target.value)}><option value="Standby">Standby — chờ kích hoạt</option><option value="Active">Active — đã kích hoạt</option></select></label><p>Nhân viên mới chưa có quyền quản trị; cấp Admin/Mod ở mục Phân quyền. Mã đã có được bỏ qua. Tài khoản mới được đánh dấu cần cập nhật bảo mật.</p><div className={styles.footer}><button type="button" disabled={working} onClick={close}>Hủy</button><button type="button" disabled={working||password.trim().length<6||(kind==="many"&&!rows.length)} onClick={()=>void create()}>Thêm nhân viên</button></div>
      </> : <>
        <p>Chọn nhóm quyền để xem toàn bộ tài khoản thuộc nhóm, không phụ thuộc bộ lọc bên ngoài.</p><div className={styles.roleChoices}>{["user","mod","admin"].map(role=><label key={role}><input type="checkbox" checked={roles.includes(role)} disabled={working} onChange={e=>{setRoles(current=>e.target.checked?[...current,role]:current.filter(value=>value!==role));setPreview(null);setConfirmation("");setAdminPassword("");}}/>{roleName(role)}</label>)}</div><button type="button" disabled={working||!roles.length} onClick={()=>void loadPreview()}>Xem trước danh sách xóa</button>
        {preview && <><div className={styles.preview} aria-label="Tài khoản sắp xóa"><b>{preview.count} tài khoản sắp xóa</b>{preview.staff.slice(0,200).map(item=><p key={item.maNV}>{item.maNV} · {item.staffName||"Chưa có tên"} · {roleName(item.role)}</p>)}{preview.count>200 && <p>Đang hiện 200 tài khoản đầu. Tải danh sách đầy đủ để xem trước.</p>}</div><button type="button" disabled={working} onClick={downloadDeletionPreview}>Tải danh sách đầy đủ</button><p>Tài khoản Admin đang dùng luôn được giữ lại. Danh sách thay đổi thì phải xem trước lại. Xóa sẽ gỡ tài khoản và quyền đăng nhập, không xóa nhật ký nghiệp vụ.</p><label>Mật khẩu Admin<PasswordInput value={adminPassword} maxLength={128} disabled={working} autoComplete="current-password" onChange={e=>setAdminPassword(e.target.value)}/></label><label>Nhập XÓA {preview.count} để xác nhận<input value={confirmation} disabled={working} autoComplete="off" onChange={e=>setConfirmation(e.target.value)}/></label><div className={styles.footer}><button type="button" disabled={working} onClick={close}>Hủy</button><button type="button" className={styles.danger} disabled={working||!preview.count||!adminPassword||confirmation!==`XÓA ${preview.count}`} onClick={()=>void removeGroup()}>Xóa {preview.count} tài khoản</button></div></>}
      </>}
    </StaffDialog>}
    {feedback && <UiFeedbackDialog tone={feedback.tone} onDismiss={()=>setFeedback(null)}>{feedback.text}</UiFeedbackDialog>}
  </>;
}
