import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublishedDemoBrands } from "@/lib/demo-store";
import DemoShell from "@/components/DemoShell";
import DemoGuideContent from "@/components/DemoGuideContent";
import styles from "@/components/Demo.module.css";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ brand: string }> };
async function findBrand(slug: string) { return (await getPublishedDemoBrands()).find(brand => brand.slug === slug); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const item = await findBrand((await params).brand);
  return { title: item ? item.guide.title : "Không tìm thấy hãng", description: item?.guide.summary };
}
export default async function DemoBrandPage({ params }: Props) {
  const item = await findBrand((await params).brand);
  if (!item) notFound();
  return <DemoShell brand={item.guide.name}><article className={styles.article}>
    <p className={styles.kicker}>GỠ DEMO · {item.guide.name}</p><h1>{item.guide.title}</h1><p className={styles.summary}>{item.guide.summary}</p>
    {item.publishedAt ? <p className={styles.updated}>Cập nhật: {new Date(item.publishedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</p> : null}
    <DemoGuideContent guide={item.guide} />
  </article></DemoShell>;
}
