import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings2, X, RefreshCcw } from "lucide-react";

interface UpdateRecord {
  content: string;
  timestamp: number;
  read: boolean;
}

interface MonitoredItem {
  id: string;
  name?: string;
  url: string;
  selector: string;
  lastContent?: string;
  updates?: UpdateRecord[];
  type: "manga" | "anime";
}

export default function Scraper({
  width = 500,
  height = 700,
}: {
  width?: number;
  height?: number;
}) {
  const [tab, setTab] = useState<"manga" | "anime">("manga");
  const [items, setItems] = useState<MonitoredItem[]>([]);
  const [showManage, setShowManage] = useState(false);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selector, setSelector] = useState("");
  const [type, setType] = useState<"manga" | "anime">("manga");

  // Load items from chrome.storage
  useEffect(() => {
    async function loadItems() {
      const { monitoredItems = [] } =
        await chrome.storage.local.get("monitoredItems");
      setItems(monitoredItems);
    }
    loadItems();
  }, []);

  const saveItems = async (newItems: MonitoredItem[]) => {
    await chrome.storage.local.set({ monitoredItems: newItems });
    setItems(newItems);
  };

  const tabItems = items.filter((item) => item.type === tab);

  const markAsRead = async (itemId: string, updateIndex: number) => {
    const updatedItems = [...items];
    const update = updatedItems.find((i) => i.id === itemId)?.updates?.[
      updateIndex
    ];
    if (update) update.read = true;
    await saveItems(updatedItems);
  };

  const handleAdd = async () => {
    if (!url || !selector) return;

    const newItem: MonitoredItem = {
      id: crypto.randomUUID(),
      name,
      url,
      selector,
      type,
      updates: [],
    };

    await saveItems([...items, newItem]);
    setName("");
    setUrl("");
    setSelector("");
    setType("manga");
  };

  const handleRemove = async (id: string) => {
    await saveItems(items.filter((i) => i.id !== id));
  };

  const handleRescrapeAll = async () => {
    try {
      console.log("Rescraping all items for tab:", tab);

      const updatedItems: MonitoredItem[] = [...items]; // clone to update safely

      for (const item of tabItems) {
        console.log(`Scraping ${item.url}...`);

        // Open the URL in a hidden tab
        const [tab] = await chrome.tabs.create({
          url: item.url,
          active: false,
        });

        if (!tab.id) {
          console.warn("Failed to create tab for", item.url);
          continue;
        }

        // Wait for the tab to finish loading
        await new Promise<void>((resolve) => {
          chrome.tabs.onUpdated.addListener(function listener(
            tabId: any,
            info: any,
          ) {
            if (tabId === tab.id && info.status === "complete") {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          });
        });

        // Execute content script to get the selector content
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (selector: string) => {
            const el = document.querySelector(selector);
            return el?.textContent ?? null;
          },
          args: [item.selector],
        });

        const content = results[0]?.result || "Unknown";
        console.log("Scraped content:", content);

        // Merge with previous updates
        const index = updatedItems.findIndex((i) => i.id === item.id);
        if (index !== -1) {
          updatedItems[index].updates = [
            ...(item.updates || []),
            { content, timestamp: Date.now(), read: false },
          ];
        }

        // Close the hidden tab
        chrome.tabs.remove(tab.id);
      }

      await saveItems(updatedItems);
      console.log("Rescrape complete!");
    } catch (err) {
      console.error("Rescrape all failed:", err);
    }
  };

  return (
    <div
      className="border rounded-lg shadow-md bg-white text-black overflow-auto"
      style={{ width, height }}
    >
      {/* Tabs + Buttons */}
      <div className="flex items-center w-full p-2 border-b">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "manga" | "anime")}
          className="flex-1"
        >
          <TabsList className="flex-1">
            <TabsTrigger value="manga" className="flex-1 text-center">
              Manga
            </TabsTrigger>
            <TabsTrigger value="anime" className="flex-1 text-center">
              Anime
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button
          variant="ghost"
          size="icon"
          className="ml-2 p-1"
          onClick={() => handleRescrapeAll()}
        >
          <RefreshCcw size={16} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="ml-1 p-1"
          onClick={() => setShowManage(true)}
        >
          <Settings2 size={16} />
        </Button>
      </div>

      {/* Content list */}
      <div className="p-2 space-y-2">
        {tabItems.length === 0 && (
          <p className="text-sm text-gray-500">No items yet.</p>
        )}

        {tabItems.map((item) => {
          const newCount = item.updates?.filter((u) => !u.read).length || 0;
          return (
            <Card key={item.id} className="flex flex-col p-2">
              <div className="flex justify-between items-center mb-1">
                <p className="font-semibold text-sm truncate">
                  {item.name || item.url}
                </p>
                {newCount > 0 && (
                  <Badge variant="destructive">{newCount}</Badge>
                )}
              </div>
              <div className="space-y-1 max-h-32 overflow-auto">
                {item.updates?.map((u, i) => (
                  <p
                    key={i}
                    className={
                      u.read
                        ? "text-gray-500 text-xs"
                        : "text-black text-xs font-semibold"
                    }
                    onClick={() => markAsRead(item.id, i)}
                  >
                    {u.content} —{" "}
                    {new Date(u.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Manage Modal */}
      <Dialog open={showManage} onOpenChange={setShowManage}>
        <DialogContent className="max-w-md">
          <DialogHeader className="flex justify-between items-center">
            <DialogTitle>Manage Monitored Sites</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowManage(false)}
            >
              <X size={16} />
            </Button>
          </DialogHeader>

          <div className="space-y-2">
            <Label>Name (optional)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />

            <Label>URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} />

            <Label>CSS Selector</Label>
            <Input
              value={selector}
              onChange={(e) => setSelector(e.target.value)}
            />

            <Label>Type</Label>
            <div className="flex gap-2">
              <Button
                variant={type === "manga" ? "default" : "outline"}
                size="sm"
                onClick={() => setType("manga")}
              >
                Manga
              </Button>
              <Button
                variant={type === "anime" ? "default" : "outline"}
                size="sm"
                onClick={() => setType("anime")}
              >
                Anime
              </Button>
            </div>

            <Button className="mt-2 w-full" onClick={handleAdd}>
              Add Site
            </Button>
          </div>

          <div className="mt-4 space-y-2 max-h-64 overflow-auto">
            {items.map((item) => (
              <Card key={item.id} className="flex justify-between p-2">
                <CardContent className="flex-1">
                  <p className="font-semibold">{item.name || item.url}</p>
                  <p className="text-xs text-gray-500">{item.url}</p>
                  <p className="text-xs text-gray-500">
                    Selector: {item.selector}
                  </p>
                  <p className="text-xs text-gray-500">Type: {item.type}</p>
                </CardContent>
                <CardContent>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemove(item.id)}
                  >
                    Remove
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
