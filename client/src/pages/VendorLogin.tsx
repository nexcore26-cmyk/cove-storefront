import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

export default function VendorLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [, navigate] = useLocation();
  const loginMutation = trpc.vendor.login.useMutation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const result = await loginMutation.mutateAsync({ username, password });
      localStorage.setItem("vendor_token", result.token);
      localStorage.setItem("vendor_name", result.vendorName);
      localStorage.removeItem("vendor_id");
      navigate("/vendor/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-6 text-center">Vendor Login</h1>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Username</label>
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              disabled={loginMutation.isPending}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              disabled={loginMutation.isPending}
            />
          </div>

          {error && <div className="text-red-500 text-sm">{error}</div>}

          <Button
            type="submit"
            className="w-full"
            disabled={loginMutation.isPending || !username || !password}
          >
            {loginMutation.isPending ? "Logging in..." : "Login"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
