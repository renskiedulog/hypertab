import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Work from "./work";
import Home from "./home";
import { StorageProvider } from "./lib/storage-provider";
import Wallpaper from "./wallpaper";
import Entertainment from "./entertainment";
import NavigationTabs from "./components/custom/navigation";
import { ThemeWatcher } from "./lib/theme-watcher";
import Customize from "./customize";

function App() {
  return (
    <StorageProvider>
      <Router>
        <Routes>
          {/* Actual pages */}
          <Route path="/" element={<Home />} />
          <Route path="/work" element={<Work />} />
          <Route path="/wallpaper" element={<Wallpaper />} />
          <Route path="/entertainment" element={<Entertainment />} />
          <Route path="/customize" element={<Customize />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <NavigationTabs />
        <ThemeWatcher />
      </Router>
    </StorageProvider>
  );
}

export default App;
