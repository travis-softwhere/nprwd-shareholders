"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/use-toast";
import ShareholderList from "@/components/ShareholderList";

interface DashboardProps {
  // Add any props needed specifically for check-in if required
}

const DASHBOARD_RETURN_KEY = "dashboard_return_from_shareholder";

const Dashboard: React.FC<DashboardProps> = ({}) => {
  const router = useRouter();

  // UI states for Check-in ONLY
  const [barcodeInput, setBarcodeInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Effect to check if returning from shareholder page (optional, kept for now)
  useEffect(() => {
    const checkForReturnFlag = () => {
      const returnFromShareholder = localStorage.getItem(DASHBOARD_RETURN_KEY);
      if (returnFromShareholder) {
        localStorage.removeItem(DASHBOARD_RETURN_KEY);
        // Optionally focus the input again or show a message
      }
    };
    checkForReturnFlag();
  }, []);



  // Handle barcode submission (Navigate to shareholder details)
  const handleBarcodeSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!barcodeInput) return;
    
    setLoading(true);
    setError("");
    
    // First, verify the shareholder exists
    try {
      const response = await fetch(`/api/shareholders?shareholderId=${barcodeInput.trim()}`);
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || "Shareholder not found.");
        toast({
          title: "Error",
          description: data.error || "Could not find this shareholder.",
          variant: "destructive",
        });
        return;
      }

      // Navigate directly to the shareholder detail page
      router.push(`/shareholders/${barcodeInput.trim()}`);
      setBarcodeInput("");

    } catch (err) {
      const errorMessage = "An error occurred while looking up shareholder.";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };



  // Simplified return statement - only the check-in card
  return (
    <div className="w-full">
      <div className="flex flex-col lg:flex-row gap-8 p-4">
        {/* Check-in Card */}
        <div className="w-full lg:w-1/3">
          <Card className="transition-shadow hover:shadow-lg sticky top-4">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 pb-4 text-center">
              <div className="mx-auto bg-blue-100 p-3 rounded-full w-fit mb-2">
                 <Search className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle className="text-xl">Find Benefit Unit Owner</CardTitle>
              <CardDescription>Scan barcode or enter ID to view details</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 pb-8">
              <form onSubmit={handleBarcodeSubmit} className="space-y-5">
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Enter ID or scan barcode"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    className="w-full pl-10 pr-4 text-center h-12 text-lg rounded-md"
                    autoFocus
                    aria-label="Shareholder ID Input"
                  />
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                </div>
                <Button 
                   type="submit" 
                   className="w-full h-12 text-base rounded-md"
                   disabled={loading || !barcodeInput}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Looking Up...
                    </>
                  ) : (
                    "Find Benefit Unit Owner"
                  )}
                </Button>
                {error && (
                   <p className="text-center text-sm font-medium text-red-600 pt-2">{error}</p>
                )}
              </form>
            </CardContent>
          </Card>
        </div>

        {/* ShareholderList */}
        <div className="w-full lg:w-2/3">
          <ShareholderList />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
