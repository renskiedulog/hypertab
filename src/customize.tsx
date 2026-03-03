import { Input } from "./components/ui/input";
import { saveImage } from "./lib/indexedDB";

const Customize = () => {
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      await saveImage(file);
    }

    alert("Backgrounds added!");
  };

  return (
    <div className="p-4">
      <label htmlFor="upload" className="block mb-2 font-medium">
        Upload Backgrounds
      </label>
      <Input
        type="file"
        id="upload"
        multiple
        accept="image/*"
        onChange={handleUpload}
      />
    </div>
  );
};

export default Customize;
