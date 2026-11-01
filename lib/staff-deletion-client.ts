import { clientErrorMessage, requestJson } from "./client-request";

type PreviewStaff = { maNV:string; staffName:string; role:string; status:string };
type DeletionPage = { protocol:2; token:string; planToken:string; page:number; pages:number; count:number; expiresAt:number; staff:PreviewStaff[] };
export type StaffDeletionPreview = DeletionPage & { tokens:string[] };
type Progress = (done:number,total:number) => void;
const post = <T extends {success?:boolean;message?:string}>(body:object) => requestJson<T>("/api/admin/staff",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({protocol:2,...body})},30_000);

export async function prepareStaffDeletion(roles:string[], progress:Progress): Promise<StaffDeletionPreview> {
  const first = (await post<{success:boolean;preview:DeletionPage}>({action:"PREVIEW_DELETE_STAFF",roles})).preview;
  if (first.protocol!==2 || first.page!==0 || !Number.isInteger(first.pages) || first.pages<1 || first.pages>150) throw new Error("Danh sách xem trước chưa hợp lệ. Xin tải lại trang.");
  const pages:DeletionPage[] = [first];
  let loaded = first.staff.length;
  progress(loaded,first.count);
  // Every request reads at most 200 records; cap parallel reads to keep mobile connections usable.
  for(let start=1;start<first.pages;start+=4) {
    const next = await Promise.all(Array.from({length:Math.min(4,first.pages-start)},async(_,index)=>{
      const page = start+index;
      const result = (await post<{success:boolean;preview:DeletionPage}>({action:"PREVIEW_DELETE_STAFF",planToken:first.planToken,page})).preview;
      if (result.protocol!==2 || result.page!==page || result.count!==first.count || result.pages!==first.pages || result.planToken!==first.planToken) throw new Error("Danh sách đã đổi. Xin xem trước lại.");
      return result;
    }));
    pages.push(...next);
    loaded += next.reduce((sum,page)=>sum+page.staff.length,0);
    progress(loaded,first.count);
  }
  const staff = pages.flatMap(page=>page.staff);
  if (staff.length!==first.count || new Set(staff.map(row=>row.maNV)).size!==first.count) throw new Error("Danh sách đã đổi. Xin xem trước lại.");
  return {...first,staff,tokens:pages.map(page=>page.token)};
}

export async function executeStaffDeletion(preview:StaffDeletionPreview,adminPassword:string,progress:Progress) {
  let deleted=0;
  for(const token of preview.tokens) {
    try {
      const result = await post<{success:boolean;result:{deleted:string[];skipped:string[];failed:string[];unprocessed:string[]}}>({action:"DELETE_STAFF_GROUP",token,adminPassword});
      deleted += result.result.deleted.length;
      progress(deleted,preview.count);
      if (result.result.skipped.length || result.result.failed.length || result.result.unprocessed.length) throw new Error("Một số tài khoản đã đổi hoặc chưa xử lý được.");
    } catch(error) {
      // Never repeat a delete after a timeout: the server may already have completed that batch.
      throw new Error(`Đã nhận xác nhận xóa ${deleted}/${preview.count} tài khoản. ${clientErrorMessage(error)} Xin kiểm tra danh sách và xem trước lại trước khi tiếp tục.`);
    }
  }
  if(deleted!==preview.count)throw new Error(`Đã xác nhận xóa ${deleted}/${preview.count} tài khoản. Xin kiểm tra danh sách trước khi tiếp tục.`);
  return deleted;
}
