import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { StorageProvider } from "./lib/storage-provider";
import Wallpaper from "./wallpaper";
import Board from "./board";
import Updates from "./updates";
import NavigationTabs from "./components/custom/navigation";
import { ThemeWatcher } from "./lib/theme-watcher";

function App() {
  return (
    <StorageProvider>
      <Router>
        <Routes>
          <Route path="/wallpaper" element={<Wallpaper />} />
          <Route path="/board" element={<Board />} />
          <Route path="/updates" element={<Updates />} />
          <Route path="*" element={<Navigate to="/wallpaper" replace />} />
        </Routes>

        <NavigationTabs />
        <ThemeWatcher />
      </Router>
    </StorageProvider>
  );
}

export default App;
