import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CartProvider } from "./contexts/CartContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import CheckoutCallback from "./pages/CheckoutCallback";
import OrderConfirmation from "./pages/OrderConfirmation";
import Account from "./pages/Account";
import Wishlist from "./pages/Wishlist";
import TrackOrder from "./pages/TrackOrder";
// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import POS from "./pages/POS";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminInventory from "./pages/admin/AdminInventory";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminTranslations from "./pages/admin/AdminTranslations";
import AdminBundles from "./pages/admin/AdminBundles";
import AdminCMS from "./pages/admin/AdminCMS";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminSalesReport from "./pages/admin/AdminSalesReport";
import AdminInventoryReport from "./pages/admin/AdminInventoryReport";
import AdminProfitReport from "./pages/admin/AdminProfitReport";
import AdminProductEdit from "./pages/admin/AdminProductEdit";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminVendors from "./pages/admin/AdminVendors";
import AdminReturnRequests from "./pages/admin/AdminReturnRequests";
import AdminCustomers from "./pages/admin/AdminCustomers";
import AdminPreOrders from "./pages/admin/AdminPreOrders";
import AdminPageBuilder from "./pages/admin/AdminPageBuilder";
import POSMySales from "./pages/admin/POSMySales";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminShipping from "./pages/admin/AdminShipping";
import AdminAttributes from "./pages/admin/AdminAttributes";
import AdminPaymentGateways from "./pages/admin/AdminPaymentGateways";
import DynamicPage from "./pages/DynamicPage";
import StaffLogin from "./pages/StaffLogin";

function Router() {
  return (
    <Switch>
      {/* Storefront */}
      <Route path="/" component={Home} />
      <Route path="/shop" component={Shop} />
      <Route path="/category/:slug" component={Shop} />
      <Route path="/product/:slug" component={ProductDetail} />
      <Route path="/cart" component={Cart} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/checkout/callback" component={CheckoutCallback} />
      <Route path="/order-confirmation" component={OrderConfirmation} />
      <Route path="/account" component={Account} />
      <Route path="/wishlist" component={Wishlist} />
      <Route path="/track-order" component={TrackOrder} />
      {/* Admin panel */}
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/products" component={AdminProducts} />
      <Route path="/admin/products/new" component={AdminProductEdit} />
      <Route path="/admin/products/:id" component={AdminProductEdit} />
      <Route path="/admin/orders" component={AdminOrders} />
      <Route path="/admin/inventory" component={AdminInventory} />
      <Route path="/admin/shipping" component={AdminShipping} />
      <Route path="/admin/payment-gateways" component={AdminPaymentGateways} />
      <Route path="/admin/settings" component={AdminSettings} />
      <Route path="/admin/translations" component={AdminTranslations} />
      <Route path="/admin/bundles" component={AdminBundles} />
      <Route path="/admin/categories" component={AdminCategories} />
      <Route path="/admin/attributes" component={AdminAttributes} />
      <Route path="/admin/cms" component={AdminCMS} />
      <Route path="/admin/analytics" component={AdminAnalytics} />
      <Route path="/admin/reports/sales" component={AdminSalesReport} />
      <Route path="/admin/reports/inventory" component={AdminInventoryReport} />
      <Route path="/admin/reports/profit" component={AdminProfitReport} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/vendors" component={AdminVendors} />
      <Route path="/admin/return-requests" component={AdminReturnRequests} />
      <Route path="/admin/customers" component={AdminCustomers} />
      <Route path="/admin/pre-orders" component={AdminPreOrders} />
      <Route path="/admin/page-builder" component={AdminPageBuilder} />
      <Route path="/admin/pos" component={POS} />
      <Route path="/admin/pos-sales" component={POSMySales} />
      {/* Dynamic pages */}
      <Route path="/staff-login" component={StaffLogin} />
      <Route path="/pages/:slug" component={DynamicPage} />
      {/* Fallback */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ThemeProvider defaultTheme="light">
          <CartProvider>
            <TooltipProvider>
              <Toaster position="top-right" richColors />
              <Router />
            </TooltipProvider>
          </CartProvider>
        </ThemeProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}

export default App;
