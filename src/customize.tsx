import { Input } from "./components/ui/input";

const Customize = () => {
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const result = reader.result as string; // base64 encoded
      const { customBackgrounds = [] } = await chrome.storage.local.get(
        "customBackgrounds"
      );

      customBackgrounds.push(result);
      await chrome.storage.local.set({ customBackgrounds });

      alert("Background added!");
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="p-4">
      <label htmlFor="upload" className="block mb-2 font-medium">
        Upload Background
      </label>
      <Input type="file" id="upload" accept="image/*" onChange={handleUpload} />
    </div>
  );
};

export default Customize;
