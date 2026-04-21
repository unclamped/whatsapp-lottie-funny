import { 
  default as makeWASocket, 
  useMultiFileAuthState, 
  DisconnectReason, 
  fetchLatestBaileysVersion 
} from "@whiskeysockets/baileys";
import fs from "fs-extra";
import path from "path";
import P from "pino";

const AUTH_FOLDER = "./auth_info_tui";
const STEALTH_DELAY = 2000; // 2 seconds delay

export default class WhatsAppClient {
  constructor(onStatus, onQr) {
    this.onStatus = onStatus || console.log;
    this.onQr = onQr || (() => {});
    this.sock = null;
    this.isReady = false;
    this.isConnecting = false;
  }

  async connect() {
    if (this.isReady || this.isConnecting) {
      this.onStatus(this.isReady ? "Already connected!" : "Connection in progress...");
      return;
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    const { version } = await fetchLatestBaileysVersion();

    this.onStatus("Connecting to WhatsApp...");
    this.isConnecting = true;

    this.sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: P({ level: "silent" }),
      browser: ["Windows", "Chrome", "146.0.0.0"]
    });

    this.sock.ev.on("creds.update", saveCreds);

    this.sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      if (qr) {
        this.onQr(qr);
        this.onStatus("Scan the QR code to connect.");
      }

      if (connection === "close") {
        this.isConnecting = false;
        this.isReady = false;
        const statusCode = (lastDisconnect?.error)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        
        if (!shouldReconnect) {
          this.onStatus("Logged out from WhatsApp. Clearing session...");
          try {
            if (fs.existsSync(AUTH_FOLDER)) {
              fs.removeSync(AUTH_FOLDER);
            }
          } catch (e) {
            this.onStatus(`Error clearing session: ${e.message}`);
          }
          this.onStatus("Session cleared. You can now connect again to scan a new QR code.");
        } else {
          this.onStatus(`Connection closed. Reconnecting...`);
          setTimeout(() => this.connect(), 3000);
        }
      } else if (connection === "open") {
        this.onStatus("Connected successfully!");
        this.isReady = true;
        this.isConnecting = false;
      }
    });
  }

  async sendSticker(jid, stickerPath) {
    if (!this.isReady) throw new Error("WhatsApp client not ready");
    if (!fs.existsSync(stickerPath)) throw new Error(`Sticker not found: ${stickerPath}`);

    this.onStatus(`Sending sticker to ${jid}...`);
    
    // 2 second delay for stealth as requested
    await new Promise(resolve => setTimeout(resolve, STEALTH_DELAY));

    const stickerBuffer = await fs.readFile(stickerPath);
    await this.sock.sendMessage(jid, {
      sticker: stickerBuffer,
      mimetype: "application/was",
      isLottie: true,
      isAnimated: true
    });

    this.onStatus("Sticker sent!");
  }
}
