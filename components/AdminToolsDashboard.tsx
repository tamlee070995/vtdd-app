"use client";

import { useMemo, useState } from "react";
import PincodeAdminTool from "@/components/PincodeAdminTool";
import { getPmhToolAvailability } from "@/lib/tool-settings";

type ToolKey = "pmh" | "coming-price" | "coming-audit";

type AdminToolsDashboardProps = {
  initialSettings: Record<string, string>;
};

const TOOLS: Array<{
  key: ToolKey;
  no: string;
  title: string;
  desc: string;
  status: string;
  configurable: boolean;
}> = [
  {
    key: "pmh",
    no: "01",
    title: "PMH / Pincode",
    desc: "Duyệt hồ sơ thẩm định, nạp kho PMH và cấp mã cho nhân viên.",
    status: "Đang hoạt động",
    configurable: true,
  },
  {
    key: "coming-price",
    no: "02",
    title: "Công cụ sắp thêm",
    desc: "Khu vực chờ để gắn thêm tool vào mục số 5.",
    status: "Chưa mở",
    configurable: false,
  },
  {
    key: "coming-audit",
    no: "03",
    title: "Báo cáo hỗ trợ",
    desc: "Khung dashboard dự phòng cho log, xuất file hoặc báo cáo sau này.",
    status: "Chưa mở",
    configurable: false,
  },
];

function isOn(value: string) {
  const v = String(value || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function toFlag(value: boolean) {
  return value ? "1" : "0";
}

function toDatetimeLocalInput(value: any) {
  const raw = String(value || "").trim().replace(/^'/, "");
  if (!raw) return "";

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T${isoMatch[4]}:${isoMatch[5]}`;

  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[,\s]+(\d{1,2}):(\d{2})/);
  if (slashMatch) {
    const a = Number(slashMatch[1]);
    const b = Number(slashMatch[2]);
    const month = a > 12 ? b : a;
    const day = a > 12 ? a : b;

    return [
      slashMatch[3],
      String(month).padStart(2, "0"),
      String(day).padStart(2, "0"),
    ].join("-") + `T${slashMatch[4].padStart(2, "0")}:${slashMatch[5]}`;
  }

  return raw;
}

export default function AdminToolsDashboard({ initialSettings }: AdminToolsDashboardProps) {
  const [openTool, setOpenTool] = useState<ToolKey | "">("pmh");
  const [settings, setSettings] = useState<Record<string, string>>({
    TOOL_PMH_ENABLED: "1",
    TOOL_PMH_SCHEDULE_ENABLED: "0",
    TOOL_PMH_START_AT: "",
    TOOL_PMH_END_AT: "",
    TOOL_PMH_LOCK_REASON: "Công cụ PMH/Pincode đang tạm đóng.",
    ...initialSettings,
  });
  const [saving, setSaving] = useState("");
  const [toast, setToast] = useState("");

  const pmhAvailability = useMemo(() => getPmhToolAvailability(settings), [settings]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function setSetting(key: string, value: string) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function saveToolSettings(updates: Record<string, string>, busyKey = "settings") {
    try {
      setSaving(busyKey);

      const payload = {
        ...settings,
        ...updates,
      };
      const res = await fetch("/api/admin/tools/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        cache: "no-store",
        body: JSON.stringify({ settings: updates }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) throw new Error(data?.message || "Không lưu được cấu hình tool.");

      setSettings({ ...payload, ...(data.settings || {}) });
      setSaving("");
      showToast(data.message || "Đã lưu cấu hình tool.");
    } catch (err: any) {
      setSaving("");
      showToast(err?.message || "Không lưu được cấu hình tool.");
    }
  }

  function toggleTool(key: ToolKey, configurable: boolean) {
    if (!configurable) return;
    setOpenTool((current) => (current === key ? "" : key));
  }

  async function togglePmhEnabled(checked: boolean) {
    const value = toFlag(checked);
    setSetting("TOOL_PMH_ENABLED", value);
    await saveToolSettings({ TOOL_PMH_ENABLED: value }, "pmh-enabled");
  }

  async function togglePmhSchedule(checked: boolean) {
    const value = toFlag(checked);
    setSetting("TOOL_PMH_SCHEDULE_ENABLED", value);
    await saveToolSettings({ TOOL_PMH_SCHEDULE_ENABLED: value }, "pmh-schedule");
  }

  async function savePmhSchedule() {
    await saveToolSettings(
      {
        TOOL_PMH_SCHEDULE_ENABLED: settings.TOOL_PMH_SCHEDULE_ENABLED || "0",
        TOOL_PMH_START_AT: settings.TOOL_PMH_START_AT || "",
        TOOL_PMH_END_AT: settings.TOOL_PMH_END_AT || "",
        TOOL_PMH_LOCK_REASON: settings.TOOL_PMH_LOCK_REASON || "",
      },
      "pmh-schedule-save"
    );
  }

  return (
    <section className="admin-tools-v5">
      <style>{STYLE}</style>

      <div className="tools-v5-head">
        <div>
          <span>MODULE 05</span>
          <h3>Quản trị công cụ hỗ trợ</h3>
          <p>Dashboard gom các công cụ độc lập. Mỗi công cụ có thể mở hoặc thu gọn riêng.</p>
        </div>
      </div>

      <div className="tools-v5-grid">
        {TOOLS.map((tool) => {
          const active = openTool === tool.key;
          const isPmh = tool.key === "pmh";
          const toolEnabled = isPmh ? pmhAvailability.enabled : false;
          const manuallyOn = isPmh ? pmhAvailability.manualEnabled : false;
          const scheduleActive = isPmh ? pmhAvailability.scheduled : false;

          return (
            <article
              key={tool.key}
              className={`tools-v5-card ${active ? "active" : ""} ${tool.configurable ? "" : "disabled"} ${!toolEnabled && isPmh ? "off" : ""}`}
            >
              <button
                type="button"
                className="tools-v5-open"
                onClick={() => toggleTool(tool.key, tool.configurable)}
                disabled={!tool.configurable}
              >
                <i>{tool.no}</i>
                <span>
                  <b>{tool.title}</b>
                  <em>{tool.desc}</em>
                </span>
              </button>

              {isPmh ? (
                <label className="tool-switch" title="Bật/tắt công cụ PMH ngoài cổng hỗ trợ">
                  <input
                    type="checkbox"
                    checked={manuallyOn}
                    disabled={saving === "pmh-enabled"}
                    onChange={(event) => togglePmhEnabled(event.target.checked)}
                  />
                  <span aria-hidden="true" />
                </label>
              ) : (
                <strong>{tool.status}</strong>
              )}

              <div className="tools-v5-status">
                {isPmh ? (
                  scheduleActive ? "Đang tắt theo lịch" : toolEnabled ? "Đang bật" : "Đang tắt"
                ) : (
                  tool.status
                )}
              </div>

              <button
                type="button"
                className="tools-v5-collapse"
                onClick={() => toggleTool(tool.key, tool.configurable)}
                disabled={!tool.configurable}
              >
                {tool.configurable ? (active ? "Thu gọn" : "Mở") : "Chưa mở"}
              </button>
            </article>
          );
        })}
      </div>

      {openTool === "pmh" ? (
        <div className="tools-v5-panel">
          <section className={`pmh-tool-config ${pmhAvailability.enabled ? "" : "off"}`}>
            <div>
              <span>Trạng thái công cụ</span>
              <h4>{pmhAvailability.enabled ? "PMH/Pincode đang bật" : "PMH/Pincode đang tắt"}</h4>
              <p>
                {pmhAvailability.enabled
                  ? "Nhân viên có thể mở công cụ ngoài cổng hỗ trợ và gửi hồ sơ."
                  : pmhAvailability.reason || "Công cụ đang tạm đóng."}
              </p>
            </div>
            <div className="pmh-tool-config-grid">
              <label className="pmh-schedule-switch">
                <input
                  type="checkbox"
                  checked={isOn(settings.TOOL_PMH_SCHEDULE_ENABLED)}
                  disabled={saving === "pmh-schedule"}
                  onChange={(event) => togglePmhSchedule(event.target.checked)}
                />
                <span />
                <b>Tắt theo lịch</b>
              </label>
              <label>
                <span>Giờ bắt đầu tắt</span>
                <input
                  type="datetime-local"
                  value={toDatetimeLocalInput(settings.TOOL_PMH_START_AT)}
                  onChange={(event) => setSetting("TOOL_PMH_START_AT", event.target.value)}
                />
              </label>
              <label>
                <span>Giờ kết thúc tắt</span>
                <input
                  type="datetime-local"
                  value={toDatetimeLocalInput(settings.TOOL_PMH_END_AT)}
                  onChange={(event) => setSetting("TOOL_PMH_END_AT", event.target.value)}
                />
              </label>
              <label className="wide">
                <span>Nội dung hiển thị khi tắt tool</span>
                <textarea
                  value={settings.TOOL_PMH_LOCK_REASON || ""}
                  onChange={(event) => setSetting("TOOL_PMH_LOCK_REASON", event.target.value)}
                  placeholder="VD: Công cụ PMH/Pincode tạm đóng để cập nhật chương trình."
                />
              </label>
              <button type="button" onClick={savePmhSchedule} disabled={saving === "pmh-schedule-save"}>
                {saving === "pmh-schedule-save" ? "Đang lưu..." : "Lưu lịch tool"}
              </button>
            </div>
          </section>

          <PincodeAdminTool />
        </div>
      ) : (
        <div className="tools-v5-empty">
          <b>Chưa mở công cụ nào</b>
          <span>Chọn một công cụ phía trên để thao tác.</span>
        </div>
      )}

      {toast ? <div className="tools-v5-toast">{toast}</div> : null}
    </section>
  );
}

const STYLE = `
.admin-tools-v5 {
  display: grid;
  gap: 14px;
}
.tools-v5-head {
  padding: 18px;
  border-radius: 24px;
  background: #07111f;
  border: 1px solid rgba(255,255,255,.1);
  box-shadow: 0 18px 54px rgba(15,23,42,.12);
}
.tools-v5-head span {
  color: #ffd400;
  font-size: 11px;
  font-weight: 1000;
  letter-spacing: .12em;
}
.tools-v5-head h3 {
  margin: 8px 0 0;
  color: #fff;
  font-size: clamp(26px, 3vw, 42px);
  line-height: 1;
  font-weight: 1000;
}
.tools-v5-head p {
  margin: 9px 0 0;
  color: rgba(255,255,255,.72);
  font-size: 13px;
  line-height: 1.45;
  font-weight: 850;
}
.tools-v5-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.tools-v5-card {
  min-height: 124px;
  padding: 14px;
  border-radius: 20px;
  border: 1px solid #dbe5ef;
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: 1fr auto;
  gap: 10px 12px;
  background: #fff;
  color: #07111f;
  box-shadow: 0 14px 34px rgba(15,23,42,.055);
}
.tools-v5-card.active {
  border-color: #07111f;
  background: linear-gradient(135deg, #fff, #fff7cc);
}
.tools-v5-card.off {
  background: linear-gradient(135deg, #fff, #f8fafc);
}
.tools-v5-card.disabled {
  opacity: .62;
}
.tools-v5-open {
  min-width: 0;
  border: 0;
  padding: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  text-align: left;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.tools-v5-open:disabled {
  cursor: not-allowed;
}
.tools-v5-open i {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  background: #07111f;
  color: #ffd400;
  font-style: normal;
  font-size: 12px;
  font-weight: 1000;
}
.tools-v5-open span {
  min-width: 0;
  display: grid;
  gap: 7px;
}
.tools-v5-open b {
  color: #07111f;
  font-size: 17px;
  line-height: 1.05;
  font-weight: 1000;
}
.tools-v5-open em {
  color: #64748b;
  font-style: normal;
  font-size: 12px;
  line-height: 1.35;
  font-weight: 850;
}
.tool-switch {
  width: 64px;
  height: 34px;
  align-self: start;
  position: relative;
  cursor: pointer;
}
.tool-switch input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.tool-switch span {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: #cbd5e1;
  box-shadow: inset 0 0 0 1px rgba(15,23,42,.08);
}
.tool-switch span::after {
  content: "";
  position: absolute;
  width: 26px;
  height: 26px;
  left: 4px;
  top: 4px;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 6px 14px rgba(15,23,42,.2);
  transition: transform .18s ease;
}
.tool-switch input:checked + span {
  background: #ffd400;
}
.tool-switch input:checked + span::after {
  transform: translateX(30px);
  background: #07111f;
}
.tools-v5-card > strong,
.tools-v5-status,
.tools-v5-collapse {
  width: fit-content;
  padding: 8px 11px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 1000;
}
.tools-v5-status {
  grid-column: 1;
  background: #eef2f7;
  color: #07111f;
}
.tools-v5-card.off .tools-v5-status {
  background: #fee2e2;
  color: #991b1b;
}
.tools-v5-collapse {
  grid-column: 2;
  border: 0;
  background: #07111f;
  color: #ffd400;
  cursor: pointer;
}
.tools-v5-collapse:disabled {
  cursor: not-allowed;
  background: #e2e8f0;
  color: #64748b;
}
.tools-v5-panel {
  min-width: 0;
  display: grid;
  gap: 12px;
}
.pmh-tool-config {
  padding: 16px;
  border-radius: 22px;
  display: grid;
  grid-template-columns: minmax(220px, .7fr) minmax(0, 1fr);
  gap: 14px;
  background: #fff;
  border: 1px solid #dbe5ef;
  box-shadow: 0 14px 34px rgba(15,23,42,.055);
}
.pmh-tool-config.off {
  border-color: #fecaca;
  background: linear-gradient(135deg, #fff, #fff7ed);
}
.pmh-tool-config > div:first-child > span,
.pmh-tool-config label > span {
  color: #64748b;
  font-size: 10px;
  font-weight: 1000;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.pmh-tool-config h4 {
  margin: 7px 0 0;
  color: #07111f;
  font-size: 22px;
  line-height: 1;
  font-weight: 1000;
}
.pmh-tool-config p {
  margin: 9px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.45;
  font-weight: 850;
}
.pmh-tool-config-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.pmh-tool-config label {
  display: grid;
  gap: 6px;
}
.pmh-tool-config label.wide {
  grid-column: 1 / -1;
}
.pmh-tool-config input,
.pmh-tool-config textarea {
  width: 100%;
  border-radius: 14px;
  border: 1px solid #dbe5ef;
  background: #f8fafc;
  color: #07111f;
  outline: none;
  font-size: 13px;
  font-weight: 850;
}
.pmh-tool-config input {
  min-height: 42px;
  padding: 0 11px;
}
.pmh-tool-config textarea {
  min-height: 76px;
  padding: 11px;
  resize: vertical;
}
.pmh-schedule-switch {
  grid-column: 1 / -1;
  min-height: 44px;
  padding: 9px 11px;
  border-radius: 16px;
  display: grid !important;
  grid-template-columns: auto auto 1fr;
  align-items: center;
  gap: 10px;
  background: #f8fafc;
  border: 1px solid #dbe5ef;
  cursor: pointer;
}
.pmh-schedule-switch input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.pmh-schedule-switch span {
  width: 48px;
  height: 28px;
  border-radius: 999px;
  display: block;
  background: #cbd5e1;
  position: relative;
}
.pmh-schedule-switch span::after {
  content: "";
  position: absolute;
  width: 22px;
  height: 22px;
  left: 3px;
  top: 3px;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 5px 12px rgba(15,23,42,.18);
  transition: transform .18s ease;
}
.pmh-schedule-switch input:checked + span {
  background: #ffd400;
}
.pmh-schedule-switch input:checked + span::after {
  transform: translateX(20px);
  background: #07111f;
}
.pmh-schedule-switch b {
  color: #07111f;
  font-size: 13px;
  font-weight: 1000;
}
.pmh-tool-config-grid button {
  grid-column: 1 / -1;
  min-height: 42px;
  border: 0;
  border-radius: 14px;
  background: #ffd400;
  color: #07111f;
  font-size: 12px;
  font-weight: 1000;
  cursor: pointer;
}
.pmh-tool-config-grid button:disabled {
  opacity: .58;
  cursor: not-allowed;
}
.tools-v5-empty {
  min-height: 180px;
  border-radius: 22px;
  border: 1px dashed #cbd5e1;
  display: grid;
  place-items: center;
  text-align: center;
  background: #f8fafc;
}
.tools-v5-empty b {
  color: #07111f;
  font-size: 20px;
  font-weight: 1000;
}
.tools-v5-empty span {
  color: #64748b;
  font-size: 13px;
  font-weight: 850;
}
.tools-v5-toast {
  position: fixed;
  left: 50%;
  bottom: 18px;
  z-index: 99999;
  transform: translateX(-50%);
  width: min(calc(100% - 24px), 460px);
  padding: 13px 14px;
  border-radius: 18px;
  background: #07111f;
  color: #fff;
  font-size: 13px;
  font-weight: 900;
  text-align: center;
  box-shadow: 0 18px 44px rgba(15,23,42,.22);
}
@media (max-width: 980px) {
  .tools-v5-grid,
  .pmh-tool-config,
  .pmh-tool-config-grid {
    grid-template-columns: 1fr;
  }
  .tools-v5-card {
    grid-template-columns: 1fr auto;
  }
}
`;
