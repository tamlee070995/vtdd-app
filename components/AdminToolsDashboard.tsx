"use client";

import { useEffect, useMemo, useState } from "react";
import AdminDataSyncPanel from "@/components/AdminDataSyncPanel";
import PincodeAdminTool from "@/components/PincodeAdminTool";
import { getPmhToolAvailability } from "@/lib/tool-settings";

type ToolKey = "pmh" | "coming-price" | "support-report" | "telegram";
type TelegramToolKey = "ChienGia" | "NgoaiDS";
type AdminRole = "admin" | "mod";
type AdminToolActionKey = "tools-pmh" | "tools-coming" | "tools-report" | "tools-telegram";

type AdminToolsDashboardProps = {
  initialSettings: Record<string, string>;
  adminRole?: AdminRole;
  adminModules?: string;
  adminActions?: string;
  adminHasExplicitActions?: boolean;
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
    key: "support-report",
    no: "03",
    title: "Báo cáo hỗ trợ",
    desc: "Đồng bộ dữ liệu, xuất log và tạo file backup.",
    status: "Đã mở",
    configurable: true,
  },
  {
    key: "telegram",
    no: "04",
    title: "Thông báo Telegram",
    desc: "Cấu hình bot, nhóm nhận tin và test riêng cho từng công cụ.",
    status: "Đã mở",
    configurable: true,
  },
];

const TELEGRAM_TOOLS: Array<{
  key: TelegramToolKey;
  prefix: string;
  title: string;
  desc: string;
}> = [
  {
    key: "ChienGia",
    prefix: "TELEGRAM_CHIENGIA",
    title: "Tổng giá TCDM thấp hơn đối thủ",
    desc: "Gửi thông báo khi nhân viên tạo hồ sơ chiến giá.",
  },
  {
    key: "NgoaiDS",
    prefix: "TELEGRAM_NGOAIDS",
    title: "Máy ngoài danh sách",
    desc: "Gửi thông báo khi nhân viên tạo hồ sơ máy ngoài danh sách.",
  },
];

const TOOL_ACTIONS: Record<ToolKey, AdminToolActionKey> = {
  pmh: "tools-pmh",
  "coming-price": "tools-coming",
  "support-report": "tools-report",
  telegram: "tools-telegram",
};

const TOOL_ACTION_LIST = Object.values(TOOL_ACTIONS);

function parseCsv(value: any) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function parseToolActions(value: any) {
  return parseCsv(value)
    .map((item) => item.replace(/^action:/, "") as AdminToolActionKey)
    .filter((item, index, arr) => TOOL_ACTION_LIST.includes(item) && arr.indexOf(item) === index);
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

export default function AdminToolsDashboard({
  initialSettings,
  adminRole = "admin",
  adminModules = "",
  adminActions = "",
}: AdminToolsDashboardProps) {
  const [openTool, setOpenTool] = useState<ToolKey | "">("pmh");
  const [showPmhConfig, setShowPmhConfig] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({
    TOOL_PMH_ENABLED: "1",
    TOOL_PMH_SCHEDULE_ENABLED: "0",
    TOOL_PMH_START_AT: "",
    TOOL_PMH_END_AT: "",
    TOOL_PMH_LOCK_REASON: "Công cụ PMH/Pincode đang tạm đóng.",
    TELEGRAM_CHIENGIA_ENABLED: "0",
    TELEGRAM_CHIENGIA_BOT_TOKEN: "",
    TELEGRAM_CHIENGIA_CHAT_ID: "",
    TELEGRAM_NGOAIDS_ENABLED: "0",
    TELEGRAM_NGOAIDS_BOT_TOKEN: "",
    TELEGRAM_NGOAIDS_CHAT_ID: "",
    ...initialSettings,
  });
  const [saving, setSaving] = useState("");
  const [toast, setToast] = useState("");

  const pmhAvailability = useMemo(() => getPmhToolAvailability(settings), [settings]);
  const isFullAdmin = String(adminRole || "").toLowerCase() === "admin";
  const grantedModules = useMemo(() => parseCsv(adminModules), [adminModules]);
  const grantedToolActions = useMemo(() => parseToolActions(adminActions), [adminActions]);
  const hasToolActions = grantedToolActions.length > 0;
  const legacyPmhAccess = grantedModules.includes("tools") && !hasToolActions;
  const visibleTools = useMemo(
    () =>
      TOOLS.filter((tool) => {
        if (isFullAdmin) return true;
        if (grantedToolActions.includes(TOOL_ACTIONS[tool.key])) return true;
        return tool.key === "pmh" && legacyPmhAccess;
      }),
    [grantedToolActions, isFullAdmin, legacyPmhAccess]
  );
  const canUseOpenTool = visibleTools.some((tool) => tool.key === openTool);

  useEffect(() => {
    if (visibleTools.length === 0) {
      if (openTool) setOpenTool("");
      if (showPmhConfig) setShowPmhConfig(false);
      return;
    }

    if (!visibleTools.some((tool) => tool.key === openTool)) {
      const firstConfigurable = visibleTools.find((tool) => tool.configurable);
      setOpenTool(firstConfigurable?.key || "");
      setShowPmhConfig(false);
    }
  }, [openTool, showPmhConfig, visibleTools]);

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

  async function savePmhSchedule() {
    if (!String(settings.TOOL_PMH_START_AT || "").trim() && !String(settings.TOOL_PMH_END_AT || "").trim()) {
      showToast("Vui lòng cài ít nhất giờ bắt đầu hoặc giờ kết thúc chạy.");
      return;
    }

    await saveToolSettings(
      {
        TOOL_PMH_ENABLED: "1",
        TOOL_PMH_SCHEDULE_ENABLED: "1",
        TOOL_PMH_START_AT: settings.TOOL_PMH_START_AT || "",
        TOOL_PMH_END_AT: settings.TOOL_PMH_END_AT || "",
        TOOL_PMH_LOCK_REASON: settings.TOOL_PMH_LOCK_REASON || "",
      },
      "pmh-schedule-save"
    );
  }

  function isSettingOn(key: string) {
    const value = String(settings[key] || "").trim().toLowerCase();
    return value === "1" || value === "true" || value === "yes" || value === "on";
  }

  function getTelegramUpdates(prefix: string) {
    const updates: Record<string, string> = {
      [`${prefix}_ENABLED`]: isSettingOn(`${prefix}_ENABLED`) ? "1" : "0",
    };
    const token = String(settings[`${prefix}_BOT_TOKEN`] || "").trim();
    const chatId = String(settings[`${prefix}_CHAT_ID`] || "").trim();

    if (token) updates[`${prefix}_BOT_TOKEN`] = token;
    if (chatId) updates[`${prefix}_CHAT_ID`] = chatId;

    return updates;
  }

  async function saveTelegramSettings(prefix: string) {
    await saveToolSettings(getTelegramUpdates(prefix), `telegram-save-${prefix}`);
  }

  async function testTelegramBot(tool: TelegramToolKey, prefix: string) {
    try {
      const updates = getTelegramUpdates(prefix);
      setSaving(`telegram-test-${prefix}`);

      const res = await fetch("/api/admin/tools/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        cache: "no-store",
        body: JSON.stringify({ tool, settings: updates }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.success) throw new Error(data?.message || "Không test được Telegram bot.");

      setSettings((current) => ({ ...current, ...updates, ...(data.settings || {}) }));
      setSaving("");
      showToast(data.message || "Đã gửi tin test Telegram.");
    } catch (err: any) {
      setSaving("");
      showToast(err?.message || "Không test được Telegram bot.");
    }
  }

  function renderPmhConfig() {
    return (
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
          <label>
            <span>Giờ bắt đầu chạy</span>
            <input
              type="datetime-local"
              value={toDatetimeLocalInput(settings.TOOL_PMH_START_AT)}
              onChange={(event) => setSetting("TOOL_PMH_START_AT", event.target.value)}
            />
          </label>
          <label>
            <span>Giờ kết thúc chạy</span>
            <input
              type="datetime-local"
              value={toDatetimeLocalInput(settings.TOOL_PMH_END_AT)}
              onChange={(event) => setSetting("TOOL_PMH_END_AT", event.target.value)}
            />
          </label>
          <label className="wide">
            <span>Nội dung hiển thị ngoài thời gian chạy</span>
            <textarea
              value={settings.TOOL_PMH_LOCK_REASON || ""}
              onChange={(event) => setSetting("TOOL_PMH_LOCK_REASON", event.target.value)}
              placeholder="VD: Công cụ PMH/Pincode chưa đến thời gian chạy."
            />
          </label>
          <button type="button" onClick={savePmhSchedule} disabled={saving === "pmh-schedule-save"}>
            {saving === "pmh-schedule-save" ? "Đang lưu..." : "Lưu lịch tool"}
          </button>
        </div>
      </section>
    );
  }

  function renderTelegramConfig() {
    return (
      <section className="telegram-tool-panel">
        <div className="telegram-tool-head">
          <span>Telegram Notification</span>
          <h4>Thông báo bot theo từng công cụ</h4>
          <p>Nhập Token/ID Bot và ID nhóm riêng cho từng luồng. Khi nhân viên gửi hồ sơ, bot sẽ báo vào nhóm đã cấu hình.</p>
        </div>

        <div className="telegram-tool-grid">
          {TELEGRAM_TOOLS.map((item) => {
            const enabledKey = `${item.prefix}_ENABLED`;
            const botKey = `${item.prefix}_BOT_TOKEN`;
            const chatKey = `${item.prefix}_CHAT_ID`;
            const saveBusy = saving === `telegram-save-${item.prefix}`;
            const testBusy = saving === `telegram-test-${item.prefix}`;

            return (
              <article className={`telegram-tool-card ${isSettingOn(enabledKey) ? "on" : ""}`} key={item.key}>
                <div className="telegram-tool-card-head">
                  <div>
                    <b>{item.title}</b>
                    <small>{item.desc}</small>
                  </div>

                  <label className="telegram-toggle">
                    <input
                      type="checkbox"
                      checked={isSettingOn(enabledKey)}
                      onChange={(event) => setSetting(enabledKey, event.target.checked ? "1" : "0")}
                    />
                    <span />
                  </label>
                </div>

                <label>
                  <span>Token / ID Bot</span>
                  <input
                    value={settings[botKey] || ""}
                    onChange={(event) => setSetting(botKey, event.target.value)}
                    placeholder="VD: 123456789:AA..."
                    autoComplete="off"
                  />
                </label>

                <label>
                  <span>ID nhóm / Chat ID</span>
                  <input
                    value={settings[chatKey] || ""}
                    onChange={(event) => setSetting(chatKey, event.target.value)}
                    placeholder="VD: -1001234567890"
                    autoComplete="off"
                  />
                </label>

                <div className="telegram-tool-actions">
                  <button type="button" onClick={() => saveTelegramSettings(item.prefix)} disabled={saveBusy || testBusy}>
                    {saveBusy ? "Đang lưu..." : "Lưu cấu hình"}
                  </button>
                  <button type="button" className="secondary" onClick={() => testTelegramBot(item.key, item.prefix)} disabled={saveBusy || testBusy}>
                    {testBusy ? "Đang test..." : "Test bot"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
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
        {visibleTools.map((tool) => {
          const active = openTool === tool.key;
          const isPmh = tool.key === "pmh";
          const isTelegram = tool.key === "telegram";
          const telegramEnabled = TELEGRAM_TOOLS.some((item) => isSettingOn(`${item.prefix}_ENABLED`));
          const toolEnabled = isPmh ? pmhAvailability.enabled : isTelegram ? telegramEnabled : false;
          const scheduleActive = isPmh ? pmhAvailability.scheduled : false;

          return (
            <article
              key={tool.key}
              className={`tools-v5-card ${active ? "active" : ""} ${tool.configurable ? "" : "disabled"} ${!toolEnabled && (isPmh || isTelegram) ? "off" : ""} ${showPmhConfig && isPmh ? "with-config" : ""}`}
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

              <strong>{isPmh ? "Theo lịch chạy" : isTelegram ? "Bot riêng" : tool.status}</strong>

              <div className="tools-v5-status">
                {isPmh
                  ? scheduleActive
                    ? "Ngoài giờ chạy"
                    : toolEnabled
                      ? "Đang trong giờ chạy"
                      : "Chưa cài giờ chạy"
                  : isTelegram
                    ? telegramEnabled
                      ? "Đang bật bot"
                      : "Chưa bật bot"
                  : tool.status}
              </div>

              <div className="tools-v5-card-actions">
                {isPmh ? (
                  <button type="button" className="tools-v5-settings-btn" onClick={() => setShowPmhConfig((current) => !current)}>
                    Cài đặt
                  </button>
                ) : null}
                <button
                  type="button"
                  className="tools-v5-collapse"
                  onClick={() => toggleTool(tool.key, tool.configurable)}
                  disabled={!tool.configurable}
                >
                  {tool.configurable ? (active ? "Thu gọn" : "Mở") : "Chưa mở"}
                </button>
              </div>

              {isPmh && showPmhConfig ? renderPmhConfig() : null}
            </article>
          );
        })}
      </div>

      {openTool === "pmh" && canUseOpenTool ? (
        <div className="tools-v5-panel">
          <PincodeAdminTool />
        </div>
      ) : openTool === "support-report" && canUseOpenTool ? (
        <div className="tools-v5-panel">
          <AdminDataSyncPanel />
        </div>
      ) : openTool === "telegram" && canUseOpenTool ? (
        <div className="tools-v5-panel">
          {renderTelegramConfig()}
        </div>
      ) : (
        <div className="tools-v5-empty">
          <b>{visibleTools.length ? "Chưa mở công cụ nào" : "Chưa có quyền công cụ"}</b>
          <span>{visibleTools.length ? "Chọn một công cụ phía trên để thao tác." : "Vui lòng liên hệ Admin để cấp quyền module 05 phù hợp."}</span>
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
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  align-items: start;
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
.tools-v5-card.with-config {
  grid-column: 1 / -1;
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
.tools-v5-card > strong,
.tools-v5-status,
.tools-v5-collapse,
.tools-v5-settings-btn {
  width: fit-content;
  min-height: 34px;
  padding: 0 11px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 1000;
}
.tools-v5-status {
  grid-column: 1;
  display: inline-flex;
  align-items: center;
  background: #eef2f7;
  color: #07111f;
}
.tools-v5-card.off .tools-v5-status {
  background: #fee2e2;
  color: #991b1b;
}
.tools-v5-card-actions {
  grid-column: 2;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  align-items: center;
}
.tools-v5-collapse,
.tools-v5-settings-btn {
  border: 0;
  cursor: pointer;
}
.tools-v5-collapse {
  background: #07111f;
  color: #ffd400;
}
.tools-v5-settings-btn {
  background: #ffd400;
  color: #07111f;
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
  grid-column: 1 / -1;
  padding: 14px;
  border-radius: 18px;
  display: grid;
  grid-template-columns: minmax(220px, .55fr) minmax(0, 1fr);
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
  font-size: 20px;
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
  min-height: 70px;
  padding: 11px;
  resize: vertical;
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
.telegram-tool-panel {
  padding: 16px;
  border-radius: 22px;
  background: #fff;
  border: 1px solid #dbe5ef;
  box-shadow: 0 14px 34px rgba(15,23,42,.055);
  display: grid;
  gap: 14px;
}
.telegram-tool-head span {
  color: #0f766e;
  font-size: 11px;
  font-weight: 1000;
  letter-spacing: .1em;
  text-transform: uppercase;
}
.telegram-tool-head h4 {
  margin: 7px 0 0;
  color: #07111f;
  font-size: 24px;
  line-height: 1;
  font-weight: 1000;
}
.telegram-tool-head p {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 13px;
  line-height: 1.45;
  font-weight: 850;
}
.telegram-tool-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.telegram-tool-card {
  padding: 14px;
  border-radius: 18px;
  border: 1px solid #dbe5ef;
  background: linear-gradient(135deg, #ffffff, #f8fafc);
  display: grid;
  gap: 12px;
}
.telegram-tool-card.on {
  border-color: #99f6e4;
  background: linear-gradient(135deg, #ffffff, #ecfdf5);
}
.telegram-tool-card-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: start;
}
.telegram-tool-card-head b {
  display: block;
  color: #07111f;
  font-size: 17px;
  line-height: 1.05;
  font-weight: 1000;
}
.telegram-tool-card-head small {
  display: block;
  margin-top: 6px;
  color: #64748b;
  font-size: 12px;
  line-height: 1.35;
  font-weight: 850;
}
.telegram-tool-card label:not(.telegram-toggle) {
  display: grid;
  gap: 6px;
}
.telegram-tool-card label:not(.telegram-toggle) span {
  color: #64748b;
  font-size: 10px;
  font-weight: 1000;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.telegram-tool-card input[type="text"],
.telegram-tool-card label:not(.telegram-toggle) input {
  width: 100%;
  min-height: 42px;
  padding: 0 11px;
  border-radius: 14px;
  border: 1px solid #dbe5ef;
  background: #fff;
  color: #07111f;
  outline: none;
  font-size: 13px;
  font-weight: 850;
}
.telegram-toggle {
  flex: 0 0 auto;
  width: 58px;
  height: 34px;
  position: relative;
  cursor: pointer;
}
.telegram-toggle input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.telegram-toggle span {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: #cbd5e1;
  box-shadow: inset 0 0 0 2px rgba(255,255,255,.5);
  transition: .18s ease;
}
.telegram-toggle span::after {
  content: "";
  position: absolute;
  width: 24px;
  height: 24px;
  top: 5px;
  left: 5px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 6px 14px rgba(15,23,42,.2);
  transition: .18s ease;
}
.telegram-toggle input:checked + span {
  background: #ffd400;
}
.telegram-toggle input:checked + span::after {
  transform: translateX(24px);
  background: #07111f;
}
.telegram-tool-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.telegram-tool-actions button {
  min-height: 42px;
  border: 0;
  border-radius: 14px;
  background: #ffd400;
  color: #07111f;
  font-size: 12px;
  font-weight: 1000;
  cursor: pointer;
}
.telegram-tool-actions button.secondary {
  background: #07111f;
  color: #ffd400;
}
.telegram-tool-actions button:disabled {
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
  .pmh-tool-config-grid,
  .telegram-tool-grid {
    grid-template-columns: 1fr;
  }
  .tools-v5-card {
    grid-template-columns: 1fr auto;
  }
  .tools-v5-card.with-config {
    grid-column: auto;
  }
  .tools-v5-card-actions {
    grid-column: 1 / -1;
    justify-content: flex-start;
  }
}
`;
