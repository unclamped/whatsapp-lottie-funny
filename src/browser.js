import React from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import fs from "fs-extra";
import path from "path";

const Select = SelectInput.default || SelectInput;

const FileBrowser = ({ onSelect, onCancel, filter = () => true, root = process.cwd(), selectDirectory = false }) => {
  const [currentDir, setCurrentDir] = React.useState(root);
  const [items, setItems] = React.useState([]);

  React.useEffect(() => {
    const loadDir = async () => {
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        
        const dirs = entries
          .filter(e => e.isDirectory())
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(e => ({ label: `📁 ${e.name}/`, value: path.join(currentDir, e.name), isDir: true }));

        const files = entries
          .filter(e => e.isFile() && filter(e.name))
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(e => ({ label: `📄 ${e.name}`, value: path.join(currentDir, e.name), isDir: false }));

        const finalItems = [
          { label: "⬅️  .. (Back)", value: "back", isDir: false },
          ...(selectDirectory ? [{ label: "✅ SELECT THIS FOLDER", value: "select_current", isDir: false }] : []),
          ...dirs,
          ...files
        ];
        
        setItems(finalItems);
      } catch (e) {
        setItems([{ label: `Error: ${e.message}`, value: "error" }]);
      }
    };

    loadDir();
  }, [currentDir, filter, selectDirectory]);

  const handleSelect = (item) => {
    if (item.value === "back") {
      const parent = path.dirname(currentDir);
      if (parent !== currentDir) setCurrentDir(parent);
    } else if (item.value === "select_current") {
      onSelect(currentDir);
    } else if (item.isDir) {
      setCurrentDir(item.value);
    } else if (item.value !== "error") {
      onSelect(item.value);
    }
  };

  return React.createElement(Box, { flexDirection: "column" },
    React.createElement(Text, { color: "blue", bold: true }, selectDirectory ? `Select Destination: ${currentDir}` : `Browsing: ${currentDir}`),
    React.createElement(Select, { items: items, onSelect: handleSelect })
  );
};

export default FileBrowser;
