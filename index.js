import React from "react";
import { render, Box, Text, useApp, useInput } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import Spinner from "ink-spinner";
import qrcode from "qrcode-terminal";
import path from "path";
import fs from "fs-extra";
import WhatsAppClient from "./src/whatsapp.js";
import { buildWasSticker } from "./src/sticker.js";
import FileBrowser from "./src/browser.js";

const Select = SelectInput.default || SelectInput;
const Input = TextInput.default || TextInput;
const Spin = Spinner.default || Spinner;

const App = () => {
  const { exit } = useApp();
  const [screen, setScreen] = React.useState("menu");
  const [status, setStatus] = React.useState("Idle");
  const [isConnected, setIsConnected] = React.useState(false);
  const [qr, setQr] = React.useState("");
  const [metadata, setMetadata] = React.useState({
    packId: "funny-bot",
    packName: "Sticker Pack",
    publisher: "Bot"
  });
  const [imagePath, setImagePath] = React.useState("");
  const [outputDir, setOutputDir] = React.useState(process.cwd());
  const [outputFileName, setOutputFileName] = React.useState("");
  const [stickerToSend, setStickerToSend] = React.useState("");
  const [phoneNumber, setPhoneNumber] = React.useState("");
  const [animation, setAnimation] = React.useState("spin");
  const [sendAfterBuild, setSendAfterBuild] = React.useState(false);

  const clientRef = React.useRef(null);

  useInput((input, key) => {
    if (key.escape) {
      setScreen("menu");
    }
    if (input === "c" && key.ctrl) {
      exit();
      process.exit(0);
    }
  });

  React.useEffect(() => {
    clientRef.current = new WhatsAppClient(
      (s) => {
        setStatus(s);
        if (s === "Connected successfully!") setIsConnected(true);
        if (s.includes("Connection closed")) setIsConnected(false);
        if (s.includes("Logged out")) setIsConnected(false);
      },
      (q) => {
        setQr(q);
        setScreen("qr");
      }
    );
  }, []);

  const handleMenuSelect = (item) => {
    if (item.value === "connect") {
      clientRef.current.connect();
    } else if (item.value === "build-send") {
      if (!isConnected) {
        setStatus("Error: You must connect to WhatsApp first!");
        return;
      }
      setSendAfterBuild(true);
      setScreen("browse-png");
    } else if (item.value === "build-only") {
      setSendAfterBuild(false);
      setScreen("browse-png");
    } else if (item.value === "send-manual") {
      if (!isConnected) {
        setStatus("Error: You must connect to WhatsApp first!");
        return;
      }
      setScreen("browse-was");
    } else if (item.value === "exit") {
      exit();
      setTimeout(() => process.exit(0), 500);
    }
  };

  const performBuild = async (img, dest, fileName, meta, anim) => {
    setScreen("loading");
    setStatus("Building sticker...");
    try {
      const finalName = fileName.trim() || path.basename(img, path.extname(img));
      const output = path.join(dest, finalName.endsWith(".was") ? finalName : `${finalName}.was`);
      
      await buildWasSticker({
        imagePath: img,
        outputPath: output,
        templatePath: path.resolve("./templates/default"),
        metadata: meta,
        animation: anim
      });
      
      setStickerToSend(output);
      setStatus(`Sticker built: ${path.basename(output)}`);
      
      if (sendAfterBuild) {
        setScreen("input-phone");
      } else {
        setScreen("menu");
      }
    } catch (e) {
      setStatus(`Error: ${e.message}`);
      setScreen("menu");
    }
  };

  const handlePhoneSubmit = async (val) => {
    setScreen("loading");
    try {
      const normalized = val.replace(/\+/g, "").replace(/\D/g, "");
      const jid = `${normalized}@s.whatsapp.net`;
      await clientRef.current.sendSticker(jid, stickerToSend);
      setScreen("menu");
    } catch (e) {
      setStatus(`Error: ${e.message}`);
      setScreen("menu");
    }
  };

  React.useEffect(() => {
    if (qr && screen === "qr") {
      console.clear();
      qrcode.generate(qr, { small: true });
    }
  }, [qr, screen]);

  React.useEffect(() => {
    if (status === "Connected successfully!" && screen === "qr") {
      setScreen("menu");
    }
  }, [status, screen]);

  const menuItems = [
    { label: "Connect to WhatsApp", value: "connect" },
    { 
      label: isConnected ? "Import PNG & Build .was (Build + Send)" : "Import PNG & Build .was (Build + Send) (Connect Required)", 
      value: "build-send",
      color: isConnected ? undefined : "gray"
    },
    { label: "Import PNG & Build .was (Save Only)", value: "build-only" },
    { 
      label: isConnected ? "Select .was and Send" : "Select .was and Send (Connect Required)", 
      value: "send-manual",
      color: isConnected ? undefined : "gray"
    },
    { label: "Exit", value: "exit" }
  ];

  return React.createElement(Box, { flexDirection: "column", padding: 1, borderStyle: "round", borderColor: "cyan" },
    React.createElement(Box, { marginBottom: 1 },
      React.createElement(Text, { bold: true, color: "yellow" }, "WhatsApp Lottie Sticker Generator 9000 Gangsta Balls")
    ),
    React.createElement(Box, { marginBottom: 1 },
      React.createElement(Text, null, "Status: "),
      React.createElement(Text, { color: isConnected ? "green" : "red" }, status)
    ),

    screen !== "menu" && React.createElement(Box, { marginBottom: 1 },
      React.createElement(Text, { color: "gray" }, "Press ESC to return to menu | Ctrl+C to exit")
    ),

    screen === "menu" && React.createElement(Select, {
      items: menuItems.map(item => ({
          ...item,
          label: item.color ? `\u001b[90m${item.label}\u001b[39m` : item.label
      })),
      onSelect: handleMenuSelect
    }),

    screen === "qr" && React.createElement(Box, { flexDirection: "column" },
      React.createElement(Text, { color: "blue" }, "Scan this QR code with WhatsApp:"),
      React.createElement(Text, null, " (QR Code shown in terminal) "),
      React.createElement(Text, { color: "gray" }, "Waiting for connection...")
    ),

    screen === "browse-png" && React.createElement(FileBrowser, {
      filter: (name) => name.toLowerCase().endsWith(".png"),
      onSelect: (p) => {
        setImagePath(p);
        setScreen("select-output-dir");
      }
    }),

    screen === "select-output-dir" && React.createElement(FileBrowser, {
      selectDirectory: true,
      onSelect: (p) => {
        setOutputDir(p);
        setScreen("input-filename");
      }
    }),

    screen === "input-filename" && React.createElement(Box, null,
      React.createElement(Text, null, "Enter Output Filename (leave empty for original): "),
      React.createElement(Input, { value: outputFileName, onChange: setOutputFileName, onSubmit: () => setScreen("select-animation") })
    ),

    screen === "select-animation" && React.createElement(Box, { flexDirection: "column" },
      React.createElement(Text, null, "Select Animation:"),
      React.createElement(Select, {
        items: [
            { label: "Spin (Continuous rotation)", value: "spin" },
            { label: "Expand (Pulse/Bounce entrance)", value: "expand" },
            { label: "Jumpscare (Sudden pop-in)", value: "jumpscare" }
        ],
        onSelect: (item) => {
            setAnimation(item.value);
            setScreen("input-packname");
        }
      })
    ),

    screen === "input-packname" && React.createElement(Box, null,
      React.createElement(Text, null, "Enter Sticker Pack Name: "),
      React.createElement(Input, { value: metadata.packName, onChange: (v) => setMetadata({ ...metadata, packName: v }), onSubmit: () => setScreen("input-publisher") })
    ),

    screen === "input-publisher" && React.createElement(Box, null,
      React.createElement(Text, null, "Enter Publisher: "),
      React.createElement(Input, { value: metadata.publisher, onChange: (v) => setMetadata({ ...metadata, publisher: v }), onSubmit: () => performBuild(imagePath, outputDir, outputFileName, metadata, animation) })
    ),

    screen === "browse-was" && React.createElement(FileBrowser, {
      filter: (name) => name.toLowerCase().endsWith(".was"),
      onSelect: (p) => {
        setStickerToSend(p);
        setScreen("input-phone");
      }
    }),

    screen === "input-phone" && React.createElement(Box, null,
      React.createElement(Text, null, "Enter Phone Number (with country code): "),
      React.createElement(Input, { value: phoneNumber, onChange: setPhoneNumber, onSubmit: handlePhoneSubmit })
    ),

    screen === "loading" && React.createElement(Box, null,
      React.createElement(Spin, { type: "dots" }),
      React.createElement(Text, null, " Processing...")
    )
  );
};

render(React.createElement(App));
