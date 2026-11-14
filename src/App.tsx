import React, { useState } from "react";
import { ArrowLeftRight, BookOpen, Home, ShoppingBag, ShoppingCart, User } from "lucide-react";
import { AppProvider, useApp } from "./context/AppContext.tsx";
import type { Product } from "./types.ts";
import { HomeView } from "./components/HomeView.tsx";
import { ShopView } from "./components/ShopView.tsx";
import { SwapView } from "./components/SwapView.tsx";
import { LearnView } from "./components/LearnView.tsx";
import { AccountView } from "./components/AccountView.tsx";
import { AdminDashboardView } from "./components/AdminDashboardView.tsx";
import { ProductDetailModal } from "./components/ProductDetailModal.tsx";
import { CartCheckoutDrawer } from "./components/CartCheckoutDrawer.tsx";

type MainTab = "home" | "shop" | "swap" | "learn" | "account";

function Shell() {
  const { cart, toast } = useApp();
  const [activeTab, setActiveTab] = useState<MainTab>("home");
  const [shopCategory, setShopCategory] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [swapTarget, setSwapTarget] = useState<{ product: Product; variantId: number } | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [adminMode, setAdminMode] = useState(false);

  const navigateTab = (tab: MainTab) => {
    setAdminMode(false);
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSelectCategory = (slug: string) => {
    setShopCategory(slug);
    navigateTab("shop");
  };

  const handleStartSwap = (product: Product, variantId: number) => {
    setSwapTarget({ product, variantId });
    navigateTab("swap");
  };

  const navItems: Array<{ id: MainTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: "home", label: "Home", icon: Home },
    { id: "shop", label: "Shop", icon: ShoppingBag },
    { id: "swap", label: "Swap", icon: ArrowLeftRight },
    { id: "learn", label: "Learn", icon: BookOpen },
    { id: "account", label: "Account", icon: User },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-[#102747] flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E3E8EF]">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => navigateTab("home")}
            className="font-display font-extrabold text-lg tracking-tight text-[#102747] whitespace-nowrap shrink-0"
          >
            Century Gadgets
          </button>

          <nav className="hidden md:flex items-center gap-7" aria-label="Primary navigation">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateTab(item.id)}
                className={`text-sm font-medium transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
                  !adminMode && activeTab === item.id
                    ? "text-[#102747] border-b-2 border-[#102747]"
                    : "text-[#667085] hover:text-[#102747]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              aria-label="Open shopping cart"
              className="px-4 py-2 min-h-[40px] rounded-xl bg-[#102747] text-white text-xs font-semibold hover:bg-[#0B1D36] transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="tabular-nums">Cart ({cart?.itemCount ?? 0})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-6 pt-6 pb-24 md:pb-12">
        {adminMode ? (
          <AdminDashboardView onExitAdmin={() => setAdminMode(false)} />
        ) : activeTab === "home" ? (
          <HomeView
            onNavigateTab={navigateTab}
            onSelectCategory={handleSelectCategory}
            onSelectProduct={setSelectedProduct}
          />
        ) : activeTab === "shop" ? (
          <ShopView initialCategory={shopCategory} onSelectProduct={setSelectedProduct} />
        ) : activeTab === "swap" ? (
          <SwapView
            preselectedTarget={swapTarget}
            onRequireSignIn={() => navigateTab("account")}
          />
        ) : activeTab === "learn" ? (
          <LearnView onSelectProduct={setSelectedProduct} />
        ) : (
          <AccountView
            onOpenAdmin={() => setAdminMode(true)}
            onSelectProduct={setSelectedProduct}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (5 Tabs) */}
      {!adminMode && (
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#E3E8EF] grid grid-cols-5 h-16"
          aria-label="Mobile bottom navigation"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigateTab(item.id)}
                className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  active ? "text-[#102747]" : "text-[#667085]"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Modals & Drawers */}
      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onStartSwap={handleStartSwap}
        onOpenCart={() => setCartOpen(true)}
      />

      <CartCheckoutDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onRequireSignIn={() => navigateTab("account")}
      />

      {toast && (
        <div
          role="status"
          className={`fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 px-4 py-3 rounded-xl text-xs font-medium text-white shadow-lg ${
            toast.type === "error" ? "bg-[#DC2626]" : "bg-[#102747]"
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
