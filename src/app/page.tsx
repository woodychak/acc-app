import Footer from "@/components/footer";
import Hero from "@/components/hero";
import Navbar from "@/components/navbar";
import {
  ArrowUpRight,
  BarChart3,
  Receipt,
  CreditCard,
  DollarSign,
  Globe,
  FileText,
  PieChart,
  Users,
} from "lucide-react";
import { createClient } from "../supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      <Navbar />
      <Hero />

      {/* Features Section */}
      <section id="features" className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">
              Comprehensive Accounting Features
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Our multi-currency accounting system provides all the tools small
              businesses need to manage their finances effectively.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                icon: <DollarSign className="w-6 h-6" />,
                title: "Multi-Currency Support",
                description:
                  "Manage finances across multiple currencies with automatic exchange rate updates",
              },
              {
                icon: <Receipt className="w-6 h-6" />,
                title: "Invoice Generation",
                description:
                  "Create professional invoices with customizable templates and automatic calculations",
              },
              {
                icon: <BarChart3 className="w-6 h-6" />,
                title: "Financial Reporting",
                description:
                  "Generate detailed reports with visualizations for better financial insights",
              },
              {
                icon: <CreditCard className="w-6 h-6" />,
                title: "Payment Tracking",
                description:
                  "Record and track payments with automatic status updates",
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="text-blue-600 mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules Section */}
      <section className="py-24 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Integrated Modules</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Our accounting system is built with dedicated modules to
              streamline your business operations.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                icon: <FileText className="w-6 h-6" />,
                title: "Products Management",
                description:
                  "Maintain a comprehensive catalog of your products with pricing in multiple currencies",
              },
              {
                icon: <Users className="w-6 h-6" />,
                title: "Customer Database",
                description:
                  "Store and manage customer information with detailed transaction history",
              },
              {
                icon: <Receipt className="w-6 h-6" />,
                title: "Invoice System",
                description:
                  "Generate, send, and track invoices with automatic payment reminders",
              },
              {
                icon: <PieChart className="w-6 h-6" />,
                title: "Financial Dashboard",
                description:
                  "View key metrics and visualizations of your business performance",
              },
            ].map((module, index) => (
              <div
                key={index}
                className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow flex items-start"
              >
                <div className="text-blue-600 mr-4 mt-1">{module.icon}</div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">{module.title}</h3>
                  <p className="text-gray-600">{module.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-blue-600 text-white">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold mb-2">30+</div>
              <div className="text-blue-100">Supported Currencies</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">1000+</div>
              <div className="text-blue-100">Business Users</div>
            </div>
            <div>
              <div className="text-4xl font-bold mb-2">99.9%</div>
              <div className="text-blue-100">Data Accuracy</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Streamline Your Accounting?
          </h2>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            Join businesses worldwide who trust our multi-currency accounting
            system to manage their finances efficiently.
          </p>
          <a
            href="/dashboard"
            className="inline-flex items-center px-6 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Access Dashboard
            <ArrowUpRight className="ml-2 w-4 h-4" />
          </a>
        </div>
      </section>

      <Footer />
    </div>
  );
}
