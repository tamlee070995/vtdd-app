import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { imeiAccess, IMEI_BRANDS, ImeiError } from "@/lib/imei";
import { imeiReport } from "@/lib/imei-report";
import ExcelJS from "exceljs";
export const runtime="nodejs"; export const dynamic="force-dynamic"; export const maxDuration=60;
export async function GET(req:NextRequest){
 const {admin,response}=await requireAdminApi(req);if(response)return response;
 if(!imeiAccess(admin!).canReport)return NextResponse.json({success:false,message:"Bạn chưa được cấp quyền xuất Excel."},{status:403});
 try{
 const filters=Object.fromEntries(["from","to","employee","store","brand","status","q"].map(k=>[k,req.nextUrl.searchParams.get(k)||""]));
 const items=await imeiReport(admin!.maNV,true,filters);
 const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet("So IMEI SN");
 sheet.addRow(["Mã lượt cấp","IMEI / SN","Hãng","Người tạo","Tên người tạo","User nhận mã","Mã siêu thị","Giờ cấp (Việt Nam)","Tình trạng","Người hủy","Giờ hủy (Việt Nam)","Lý do hủy"]);
 const date=(s:string)=>s?new Date(s).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"}):"";
 const states={active:"Đã cấp",cancelled:"Đã hủy",pending:"Chưa xong",conflict:"Chưa cấp"};
 for(const item of items)sheet.addRow([item.requestId,item.imei||"",IMEI_BRANDS[item.brand],item.actor,item.actorName,item.recipient||"",item.storeCode||"",date(item.createdAt),states[item.status],item.cancelledBy||"",date(item.cancelledAt||""),item.reason||""]);
 sheet.columns.forEach((col,index)=>{col.width=index===0?38:24;col.numFmt="@"});sheet.getRow(1).font={bold:true};sheet.views=[{state:"frozen",ySplit:1}];sheet.autoFilter={from:"A1",to:"L1"};
 const buffer=await workbook.xlsx.writeBuffer();
 return new NextResponse(new Uint8Array(buffer),{headers:{"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":'attachment; filename="so-imei-sn.xlsx"',"Cache-Control":"private, no-store"}});
 }catch(e){return NextResponse.json({success:false,message:e instanceof ImeiError?e.message:"Chưa xuất được Excel. Xin thử lại."},{status:e instanceof ImeiError?e.status:503})}
}
