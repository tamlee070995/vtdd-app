"use client";

import { useEffect, useState } from "react";

type LightboxState = {
  src: string;
  alt: string;
} | null;

const CMS_IMAGE_SELECTOR = [
  ".cms-preview-body img",
  ".cms-public-body img",
  ".cms-page-body img",
  ".cms-detail-body img",
  ".cms-content img",
  ".cms-article-content img",
  ".cms-article-body img",
  ".home-cms-body img",
  ".home-cms-content img",
  ".article-content img",
  ".public-article-body img",
  "main article img",
].join(",");

export default function CmsImageLightbox() {
  const [image, setImage] = useState<LightboxState>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const img = target.closest(CMS_IMAGE_SELECTOR) as HTMLImageElement | null;
      if (!img || !img.src) return;

      event.preventDefault();
      event.stopPropagation();

      setImage({
        src: img.src,
        alt: img.alt || "Ảnh bài viết",
      });
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setImage(null);
      }
    }

    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!image) {
      document.body.classList.remove("cms-lightbox-open");
      return;
    }

    document.body.classList.add("cms-lightbox-open");

    return () => {
      document.body.classList.remove("cms-lightbox-open");
    };
  }, [image]);

  if (!image) return null;

  return (
    <div className="cms-lightbox-layer" role="dialog" aria-modal="true">
      <button
        type="button"
        className="cms-lightbox-backdrop"
        aria-label="Đóng ảnh"
        onClick={() => setImage(null)}
      />

      <div className="cms-lightbox-card">
        <button
          type="button"
          className="cms-lightbox-close"
          aria-label="Đóng"
          onClick={() => setImage(null)}
        >
          ×
        </button>

        <img src={image.src} alt={image.alt} />

        <div className="cms-lightbox-hint">Chạm bên ngoài hoặc bấm ESC để đóng</div>
      </div>
    </div>
  );
}