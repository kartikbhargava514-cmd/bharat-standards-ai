import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, FileText, Layers, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import logoAsset from "@/assets/logo.asset.json";

const ORG_TYPES = ["Central Govt", "State Govt", "PSU", "Private", "Other"] as const;

// Min 8 chars, at least one uppercase, one lowercase, one digit, one special character.
const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal", "Delhi", "Jammu & Kashmir", "Ladakh", "Chandigarh",
  "Puducherry", "Andaman & Nicobar Islands", "Dadra & Nagar Haveli and Daman & Diu",
  "Lakshadweep",
] as const;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BharatStandAI — Sign in" },
      {
        name: "description",
        content:
          "Sign in to BharatStandAI to identify the right Indian Standards for your tender specifications.",
      },
      { property: "og:title", content: "BharatStandAI — AI-Powered Indian Standards" },
      {
        property: "og:description",
        content:
          "Smarter procurement, safer products, stronger India. Find the right IS standards instantly.",
      },
    ],
  }),
  component: AuthPage,
});

const stats = [
  { icon: FileText, value: "24,000+", label: "Indian Standards" },
  { icon: Layers, value: "5+", label: "Product Categories" },
  { icon: ShieldCheck, value: "100%", label: "Better Compliance" },
];

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [designation, setDesignation] = useState("");
  const [state, setState] = useState("");
  const [orgType, setOrgType] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function saveProfile(details?: {
    name: string;
    phone: string;
    department: string;
    designation: string;
    state: string;
    orgType: string;
  }) {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return;
    await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email ?? null,
      full_name: details?.name ?? (user.user_metadata?.["full_name"] as string) ?? null,
      phone: details?.phone ?? null,
      department: details?.department ?? null,
      designation: details?.designation ?? null,
      state: details?.state ?? null,
      org_type: details?.orgType ?? null,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "register") {
        if (!PASSWORD_RE.test(password)) {
          toast.error(
            "Password must be at least 8 characters with a capital letter, a small letter, a number and a special character.",
          );
          setLoading(false);
          return;
        }
        if (!orgType || !state) {
          toast.error("Please select your state and organisation type.");
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, department },
          },
        });
        if (error) throw error;
        await saveProfile({
          name: fullName.trim(),
          phone: phone.trim(),
          department: department.trim(),
          designation: designation.trim(),
          state,
          orgType,
        });
        toast.success("Account created. Welcome to BharatStandAI.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await saveProfile();
        toast.success("Signed in successfully.");
      }
      await router.invalidate();
      navigate({ to: "/dashboard", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed. Please try email sign-in.");
      return;
    }
    if (result.redirected) return;
    await saveProfile();
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <div className="surface-gradient relative flex flex-col justify-between px-8 py-12 text-navy-foreground sm:px-14">
        <div className="tricolour-rule absolute inset-x-0 top-0 h-1" />
        <div>
          <img
            src={logoAsset.url}
            alt="BharatStandAI"
            className="h-20 w-20 rounded-xl bg-white/95 p-2"
          />
          <p className="mt-3 font-display text-2xl font-bold tracking-tight">BharatStandAI</p>
          <h1 className="mt-8 max-w-lg font-display text-3xl leading-tight font-bold sm:text-4xl">
            AI-Powered Indian Standards Recommendation System
          </h1>
          <p className="mt-4 text-sm font-medium text-navy-foreground/80">
            Smarter Procurement <span className="text-saffron">|</span> Safer Products{" "}
            <span className="text-saffron">|</span> Stronger India
          </p>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-navy-foreground/70">
            Helping government departments, PSUs and procurement agencies identify the right Indian
            Standards for their products and services using artificial intelligence.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-3 gap-4">
          {stats.map(({ icon: Icon, value, label }) => (
            <div key={label} className="rounded-xl bg-white/10 p-4 backdrop-blur-sm">
              <Icon className="h-5 w-5 text-saffron" />
              <p className="mt-3 font-display text-xl font-bold">{value}</p>
              <p className="text-xs text-navy-foreground/70">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-card px-6 py-12">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-2xl font-bold text-foreground">
            {mode === "login" ? "Welcome Back" : "Create your account"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login"
              ? "Sign in to your account"
              : "Register as a procurement official to get started"}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {mode === "register" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                    maxLength={100}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 98765 43210"
                    required
                    maxLength={20}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="dept">Department / Organisation</Label>
                    <Input
                      id="dept"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. PWD"
                      maxLength={120}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="desig">Designation</Label>
                    <Input
                      id="desig"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      placeholder="e.g. Procurement Officer"
                      maxLength={120}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>State</Label>
                    <Select value={state} onValueChange={setState}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        {INDIAN_STATES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Organisation type</Label>
                    <Select value={orgType} onValueChange={setOrgType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {ORG_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                maxLength={255}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  minLength={6}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "login" ? "Login" : "Register"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full" onClick={handleGoogle} type="button">
            Continue with Google
          </Button>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "login" ? "Don't have an account?" : "Already registered?"}{" "}
            <button
              type="button"
              className="font-semibold text-primary hover:underline"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? "Register" : "Login"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
