import { useEffect, useState } from "react";
import { useStorage } from "./lib/storage-provider";
import { Navigate, useLocation } from "react-router-dom";

function InitialRedirect() {
  const { getItem } = useStorage();
  const [initialPath, setInitialPath] = useState<string | null>(null);
  const location = useLocation();

  const currentPath = location.hash.replace(/^#/, "") || "/";

  useEffect(() => {
    const alreadyRedirected = sessionStorage.getItem("hasRedirected");

    if (currentPath !== "/" || alreadyRedirected) return;

    const preferredPage = `/${getItem<string>("preferredPage")}`;

    const validRedirects = ["/wallpaper", "/normal", "/work", "/entertainment"];

    if (preferredPage && validRedirects.includes(preferredPage)) {
      setInitialPath(preferredPage);
    } else {
      setInitialPath("/");
    }

    sessionStorage.setItem("hasRedirected", "true");
  }, [getItem, currentPath]);

  if (
    currentPath === "/" &&
    !initialPath &&
    !sessionStorage.getItem("hasRedirected")
  ) {
    return <div className="p-4">Loading...</div>;
  }

  if (initialPath && initialPath !== currentPath) {
    return <Navigate to={initialPath} replace />;
  }

  return null;
}

const Home = () => {
  return (
    <div>
      <InitialRedirect />
      <ChooseDefaultPage />
    </div>
  );
};

export default Home;

function ChooseDefaultPage() {
  const { setItem } = useStorage();

  const handleChoice = (
    choice: "wallpaper" | "normal" | "work" | "entertainment"
  ) => {
    setItem("preferredPage", choice);
    alert(`Default page set to ${choice}`);
  };

  return (
    <div className="flex gap-4 p-4">
      <button
        onClick={() => handleChoice("wallpaper")}
        className="bg-primary text-primary-foreground px-4 py-2 rounded"
      >
        Set Wallpaper as Default
      </button>
      <button
        onClick={() => handleChoice("normal")}
        className="bg-primary text-primary-foreground px-4 py-2 rounded"
      >
        Set Normal as Default
      </button>
      <button
        onClick={() => handleChoice("work")}
        className="bg-primary text-primary-foreground px-4 py-2 rounded"
      >
        Set Normal as Work
      </button>
      <button
        onClick={() => handleChoice("entertainment")}
        className="bg-primary text-primary-foreground px-4 py-2 rounded"
      >
        Set Normal as Entertainment
      </button>
    </div>
  );
}
