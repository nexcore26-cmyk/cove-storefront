/**
 * B6 — POS Settings: terminal name, hours, receipt header/footer
 */
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Settings, Save, Monitor, Clock, FileText } from "lucide-react";
import { toast } from "sonner";

export default function POSSettings() {
  const { data: settings, isLoading } = trpc.pos.getSettings.useQuery();
  const updateSettings = trpc.pos.updateSettings.useMutation({
    onSuccess: () => toast.success("Settings saved"),
    onError: (err) => toast.error(err.message),
  });

  const [terminalName, setTerminalName] = useState("");
  const [openingHour, setOpeningHour] = useState(9);
  const [closingHour, setClosingHour] = useState(21);
  const [receiptHeader, setReceiptHeader] = useState("");
  const [receiptFooter, setReceiptFooter] = useState("");

  useEffect(() => {
    if (settings) {
      setTerminalName(settings.posTerminalName ?? "Register 1");
      setOpeningHour(settings.posOpeningHour ?? 9);
      setClosingHour(settings.posClosingHour ?? 21);
      setReceiptHeader(settings.posReceiptHeader ?? "");
      setReceiptFooter(settings.posReceiptFooter ?? "");
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate({
      posTerminalName: terminalName,
      posOpeningHour: openingHour,
      posClosingHour: closingHour,
      posReceiptHeader: receiptHeader || undefined,
      posReceiptFooter: receiptFooter || undefined,
    });
  };

  const hours = Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`,
  }));

  if (isLoading) {
    return (
      <div className="flex-1 p-6 space-y-4">
        {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-lg space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">POS Settings</h1>
            <p className="text-sm text-muted-foreground">{settings?.storeName ?? "Store"}</p>
          </div>
          <Settings className="w-5 h-5 text-muted-foreground" />
        </div>

        {/* Terminal */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <Monitor className="w-4 h-4" />
            Terminal
          </h2>
          <div>
            <Label htmlFor="terminalName">Terminal Name</Label>
            <Input
              id="terminalName"
              value={terminalName}
              onChange={e => setTerminalName(e.target.value)}
              placeholder="e.g. Register 1, Counter A"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">Shown on the Board screen and receipts</p>
          </div>
        </div>

        {/* Opening hours */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Operating Hours
          </h2>
          <p className="text-xs text-muted-foreground">Used to define the hourly sales chart range on the Board screen.</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="openingHour">Opening Hour</Label>
              <select
                id="openingHour"
                value={openingHour}
                onChange={e => setOpeningHour(Number(e.target.value))}
                className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
              >
                {hours.map(h => (
                  <option key={h.value} value={h.value}>{h.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="closingHour">Closing Hour</Label>
              <select
                id="closingHour"
                value={closingHour}
                onChange={e => setClosingHour(Number(e.target.value))}
                className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
              >
                {hours.map(h => (
                  <option key={h.value} value={h.value}>{h.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Receipt */}
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Receipt
          </h2>
          <div>
            <Label htmlFor="receiptHeader">Header Text</Label>
            <Textarea
              id="receiptHeader"
              value={receiptHeader}
              onChange={e => setReceiptHeader(e.target.value)}
              placeholder="e.g. Cove Interior&#10;Tel: +965 XXXX XXXX&#10;www.coveinterior.com"
              rows={3}
              className="mt-1 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">Printed at the top of each receipt</p>
          </div>
          <div>
            <Label htmlFor="receiptFooter">Footer Text</Label>
            <Textarea
              id="receiptFooter"
              value={receiptFooter}
              onChange={e => setReceiptFooter(e.target.value)}
              placeholder="e.g. Thank you for shopping with us!&#10;No exchange after 7 days."
              rows={3}
              className="mt-1 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">Printed at the bottom of each receipt</p>
          </div>
        </div>

        {/* Save */}
        <Button
          className="w-full bg-blue-600 hover:bg-blue-700"
          onClick={handleSave}
          disabled={updateSettings.isPending}
        >
          <Save className="w-4 h-4 mr-2" />
          {updateSettings.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
