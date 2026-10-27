"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { PORTAL_GROUPS, portalGroupForPath } from "@/lib/portal-navigation";
import { useAppNavigation } from "./AppNavigationFeedback";
import PageSkeleton from "./PageSkeleton";
import styles from "@/app/page.module.css";

const PortalContext = createContext({ activeId: "he-thu-cu-doi-moi" });
export const usePortalGroup = () => useContext(PortalContext);

function NavIcon({ name }: { name: string }) {
  const symbols: Record<string, string> = { tradein: "thu-cu-doi-moi", phone: "may-moi", used: "may-cu", demo: "demo", tools: "cong-cu" };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><use href={`/icons/home-navigation-v1.svg#icon-${symbols[name]}`} /></svg>;
}

export default function PortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [homeGroup, setHomeGroup] = useState<string>(PORTAL_GROUPS[0].id);
  const { loading } = useAppNavigation();
  const publicPage = pathname === "/" || Boolean(portalGroupForPath(pathname));
  const activeId = pathname === "/" ? homeGroup : portalGroupForPath(pathname) || homeGroup;
  useEffect(() => {
    const restore = () => {
      const id = location.hash.slice(1);
      setHomeGroup(PORTAL_GROUPS.some(group => group.id === id) ? id : PORTAL_GROUPS[0].id);
    };
    restore();
    window.addEventListener("hashchange", restore);
    window.addEventListener("popstate", restore);
    return () => { window.removeEventListener("hashchange", restore); window.removeEventListener("popstate", restore); };
  }, [pathname]);

  if (!publicPage) return children;
  return <PortalContext.Provider value={{ activeId }}><div className={styles.page} data-portal-shell>
    <a className={styles.skipLink} href="#noi-dung" data-portal-chrome>Đến nội dung</a>
    <aside className={styles.sidebar} data-portal-chrome>
      <header className={styles.brandRow} data-ui-header>
        <Link className={styles.brand} href="/" aria-label="Viễn Thông Di Động — Trang chủ"><Image src="/brand/vtdd-logo-header-v3.webp" width={52} height={52} alt="Viễn Thông Di Động" unoptimized priority /><span><strong>ICT</strong><small>Viễn Thông Di Động</small></span></Link>
        <Link className={styles.mobileAdmin} href="/admin">Admin</Link>
      </header>
      <nav className={styles.navigation} data-ui-bottom-nav aria-label="Danh mục nghiệp vụ">
        <div className={styles.navHeading}>DANH MỤC NGHIỆP VỤ</div>
        <div className={styles.tabs}>{PORTAL_GROUPS.map(group => <Link key={group.id} className={styles.tab} href={`/#${group.id}`} aria-current={activeId === group.id ? "page" : undefined} onClick={event => {
          if (pathname !== "/" || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          setHomeGroup(group.id);
          history.replaceState(history.state, "", `#${group.id}`);
          window.scrollTo({ top: 0, behavior: "instant" });
        }}><span className={styles.navIcon}><NavIcon name={group.icon} /></span><span className={styles.desktopLabel}>{group.title}</span><span className={styles.mobileLabel}>{group.shortTitle}</span></Link>)}</div>
      </nav>
      <div className={styles.sidebarFooter}><p>Chính sách &amp; nghiệp vụ<br />sản phẩm viễn thông</p><Link className={styles.adminButton} href="/admin"><span>Quản trị hệ thống</span><span aria-hidden="true">↗</span></Link></div>
    </aside>
    <div className={styles.portalBody} id="noi-dung" tabIndex={-1} aria-busy={loading}>
      <div className={styles.routeContent} style={loading ? { visibility: "hidden" } : undefined} inert={loading || undefined}>{children}</div>
      {loading && <div className={styles.routeSkeleton}><PageSkeleton /></div>}
    </div>
  </div></PortalContext.Provider>;
}
