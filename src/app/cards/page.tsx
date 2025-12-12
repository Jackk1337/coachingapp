"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Html5Qrcode } from "html5-qrcode";
import JsBarcode from "jsbarcode";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, orderBy } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, Plus, Trash2, Scan, CreditCard } from "lucide-react";
import { toast } from "sonner";

interface UserCard {
  id: string;
  name: string;
  barcode: string;
  barcodeFormat?: string;
  userId: string;
  createdAt: Date | { seconds: number; nanoseconds: number } | string;
}

export default function CardsPage() {
  const { user } = useAuth();
  const [cards, setCards] = useState<UserCard[]>([]);
  const [createCardOpen, setCreateCardOpen] = useState(false);
  const [cardName, setCardName] = useState("");
  const [cardBarcode, setCardBarcode] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string>("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerElementId = "card-barcode-scanner";
  const [viewCardDialogOpen, setViewCardDialogOpen] = useState(false);
  const [viewingCard, setViewingCard] = useState<UserCard | null>(null);

  // Fetch cards
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "user_cards"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cardList: UserCard[] = [];
      snapshot.forEach((doc) => {
        cardList.push({ id: doc.id, ...doc.data() } as UserCard);
      });
      setCards(cardList);
    });

    return () => unsubscribe();
  }, [user]);

  // Start scanner when isScanning becomes true and element is available
  useEffect(() => {
    if (!isScanning) return;

    const element = document.getElementById(scannerElementId);
    if (!element) {
      // Element not yet rendered, wait a bit and retry
      const timer = setTimeout(() => {
        const retryElement = document.getElementById(scannerElementId);
        if (retryElement && isScanning) {
          initializeScanner();
        }
      }, 100);
      return () => clearTimeout(timer);
    }

    initializeScanner();
  }, [isScanning]);

  const startScanner = () => {
    if (isScanning) return;

    // Check if browser supports camera
    if (typeof window === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setScanError("Camera not supported in this browser");
      return;
    }

    // Check if HTTPS (required for camera access)
    if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
      setScanError("Camera access requires HTTPS. Please use HTTPS or localhost.");
      return;
    }

    setScanError("");
    setIsScanning(true);
  };

  const initializeScanner = async () => {
    const element = document.getElementById(scannerElementId);
    if (!element) {
      setScanError("Scanner element not found");
      setIsScanning(false);
      return;
    }

    try {
      const html5QrCode = new Html5Qrcode(scannerElementId);
      scannerRef.current = html5QrCode;

      // Get element dimensions for better scanning box
      const elementWidth = element.clientWidth || 300;
      const elementHeight = element.clientHeight || 300;
      const qrboxSize = Math.min(250, Math.min(elementWidth - 20, elementHeight - 20));

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: qrboxSize, height: qrboxSize },
        },
        (decodedText) => {
          // Barcode scanned successfully
          setCardBarcode(decodedText);
          stopScanner();
          toast.success("Barcode scanned successfully!");
        },
        (errorMessage) => {
          // Ignore common scanning errors
          if (!errorMessage.includes("NotFoundException") && !errorMessage.includes("No MultiFormat Readers")) {
            console.debug("Scanner:", errorMessage);
          }
        }
      );

      // Explicitly style the video element after it's rendered
      setTimeout(() => {
        const videoElement = element.querySelector('video');
        if (videoElement) {
          videoElement.style.width = '100%';
          videoElement.style.height = 'auto';
          videoElement.style.objectFit = 'contain';
          videoElement.style.display = 'block';
        }
      }, 500);
    } catch (err) {
      console.error("Error starting scanner:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to start camera";
      setScanError(errorMessage);
      setIsScanning(false);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.stop().then(() => {
        scannerRef.current = null;
        setIsScanning(false);
        setScanError("");
      }).catch((err) => {
        console.error("Error stopping scanner:", err);
        setIsScanning(false);
      });
    } else {
      setIsScanning(false);
    }
  };

  const handleCreateCard = async () => {
    if (!user || !cardName.trim() || !cardBarcode.trim()) {
      toast.error("Please provide a card name and barcode");
      return;
    }

    try {
      await addDoc(collection(db, "user_cards"), {
        userId: user.uid,
        name: cardName.trim(),
        barcode: cardBarcode.trim(),
        createdAt: new Date(),
      });

      toast.success("Card created successfully!");
      setCreateCardOpen(false);
      setCardName("");
      setCardBarcode("");
      if (isScanning) {
        stopScanner();
      }
    } catch (error) {
      console.error("Error creating card:", error);
      toast.error("Failed to create card");
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!confirm("Are you sure you want to delete this card?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "user_cards", cardId));
      toast.success("Card deleted successfully");
    } catch (error) {
      console.error("Error deleting card:", error);
      toast.error("Failed to delete card");
    }
  };

  const handleViewCard = (card: UserCard) => {
    setViewingCard(card);
    setViewCardDialogOpen(true);
  };

  // Barcode component
  const BarcodeDisplay = ({ barcodeValue, id }: { barcodeValue: string; id: string }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      if (canvasRef.current && barcodeValue) {
        try {
          JsBarcode(canvasRef.current, barcodeValue, {
            format: "CODE128",
            width: 2,
            height: 80,
            displayValue: true,
            fontSize: 16,
            margin: 10,
            background: "#ffffff",
            lineColor: "#000000",
          });
        } catch (error) {
          console.error("Error generating barcode:", error);
        }
      }
    }, [barcodeValue]);

    return <canvas ref={canvasRef} id={id} className="w-full" />;
  };

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Cards</h1>
          <div className="w-10"></div> {/* Spacer for centering */}
        </div>
      </div>

      <div className="px-4 py-6">
        {/* Create Card Button */}
        <Button 
          className="w-full mb-6"
          onClick={() => setCreateCardOpen(true)}
        >
          <Plus className="mr-2 h-5 w-5" /> Create Card
        </Button>

        {/* Create Card Dialog */}
        <Dialog open={createCardOpen} onOpenChange={(open) => {
          setCreateCardOpen(open);
          if (!open) {
            setCardName("");
            setCardBarcode("");
            if (isScanning) {
              stopScanner();
            }
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Card</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cardName">Card Name *</Label>
                <Input
                  id="cardName"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  placeholder="e.g. Gym Membership Card"
                  disabled={isScanning}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cardBarcode">Barcode *</Label>
                <div className="flex gap-2">
                  <Input
                    id="cardBarcode"
                    value={cardBarcode}
                    onChange={(e) => setCardBarcode(e.target.value)}
                    placeholder="Scan or enter barcode"
                    disabled={isScanning}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={isScanning ? stopScanner : startScanner}
                    disabled={!cardName.trim()}
                  >
                    <Scan className="h-4 w-4 mr-2" />
                    {isScanning ? "Stop" : "Scan"}
                  </Button>
                </div>
                {scanError && (
                  <p className="text-sm text-destructive">{scanError}</p>
                )}
              </div>

              {/* Scanner View - Always render but hide when not scanning */}
              <div className={`space-y-2 ${!isScanning ? 'hidden' : ''}`}>
                <Label>Scanner</Label>
                <div 
                  id={scannerElementId}
                  className="w-full rounded-lg overflow-hidden bg-black min-h-[300px] flex items-center justify-center"
                />
                {isScanning && (
                  <p className="text-xs text-muted-foreground text-center">
                    Point your camera at the barcode
                  </p>
                )}
              </div>

              <Button
                onClick={handleCreateCard}
                disabled={!cardName.trim() || !cardBarcode.trim() || isScanning}
                className="w-full"
              >
                Create Card
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Cards Wallet */}
        <div className="space-y-4">
          {cards.length === 0 ? (
            <div className="text-center py-10 border border-dashed rounded-lg">
              <CreditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No cards yet. Create your first card!</p>
            </div>
          ) : (
            cards.map((card) => (
              <Card 
                key={card.id} 
                className="cursor-pointer hover:shadow-lg transition-all border-2 overflow-hidden bg-gradient-to-br from-card to-card/80"
                onClick={() => handleViewCard(card)}
              >
                <CardHeader className="flex flex-row items-center justify-between pb-3 border-b bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg font-semibold">{card.name}</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCard(card.id);
                    }}
                    className="text-destructive hover:bg-destructive/10 h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="bg-white rounded-lg p-4 border-2 border-dashed border-muted">
                    <BarcodeDisplay barcodeValue={card.barcode} id={`barcode-${card.id}`} />
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-3">
                    Tap to view full barcode
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* View Card Dialog - Shows Barcode */}
      <Dialog open={viewCardDialogOpen} onOpenChange={setViewCardDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">{viewingCard?.name}</DialogTitle>
          </DialogHeader>
          {viewingCard && (
            <div className="space-y-4">
              {/* Card-like display */}
              <div className="bg-gradient-to-br from-card to-card/80 rounded-xl border-2 border-primary/20 p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4 pb-4 border-b">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <CreditCard className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{viewingCard.name}</h3>
                    <p className="text-xs text-muted-foreground">Membership Card</p>
                  </div>
                </div>
                
                {/* Barcode Display */}
                <div className="bg-white rounded-lg p-6 border-2 border-muted shadow-inner">
                  <BarcodeDisplay barcodeValue={viewingCard.barcode} id={`barcode-view-${viewingCard.id}`} />
                </div>
                
                {/* Barcode Number */}
                <div className="mt-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Barcode Number</p>
                  <p className="text-sm font-mono font-semibold break-all">{viewingCard.barcode}</p>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground text-center">
                Show this barcode at the scanner
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

