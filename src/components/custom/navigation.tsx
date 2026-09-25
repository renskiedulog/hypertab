"use client";

import * as React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTheme } from "next-themes";
import { useNavigate, useLocation } from "react-router-dom";
import { Image, Layout } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const routes = [
  { path: "/wallpaper", value: "wallpaper", label: "Wallpaper", icon: Image },
  { path: "/board", value: "board", label: "Board", icon: Layout },
];

const themeMap: Record<string, string> = {
  "/wallpaper": "light",
  "/board": "light",
};

export default function NavigationTabs() {
  const { setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab =
    routes.find((route) => location.pathname === route.path)?.value || "normal";

  React.useEffect(() => {
    const theme = themeMap[location.pathname];
    if (theme) setTheme(theme);
  }, [location.pathname, setTheme]);

  const handleTabChange = (value: string) => {
    const route = routes.find((r) => r.value === value);
    if (route) {
      navigate(route.path);
    }
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="absolute bottom-1/2 left-5 translate-y-1/2 max-w-fit"
    >
      <TooltipProvider>
        <TabsList className="flex flex-col gap-3 bg-transparent shadow-none">
          {routes.map((route) => {
            const Icon = route.icon;
            return (
              <Tooltip key={route.label}>
                <TooltipTrigger asChild>
                  <TabsTrigger
                    key={route.value}
                    value={route.value}
                    className={`flex items-center justify-center py-5 px-2.5 rounded-xl hover:bg-muted transition-colors cursor-pointer ${
                      activeTab === route.value
                        ? "text-black bg-white"
                        : "text-white hover:text-black"
                    }`}
                  >
                    <Icon className="!w-6 !h-6" />
                  </TabsTrigger>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="text-xs text-black bg-white"
                >
                  {route.label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TabsList>
      </TooltipProvider>
    </Tabs>
  );
}
