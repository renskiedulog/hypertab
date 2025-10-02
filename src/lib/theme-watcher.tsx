import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function ThemeWatcher() {
  const location = useLocation();

  useEffect(() => {
    const body = document.body;

    body.classList.remove("light", "blue", "rose");

    // Apply theme based on route
    if (location.pathname === "/work") {
      body.classList.add("blue");
    } else if (location.pathname === "/entertainment") {
      body.classList.add("rose");
    } else {
      body.classList.add("light");
    }
  }, [location.pathname]);

  return null;
}
