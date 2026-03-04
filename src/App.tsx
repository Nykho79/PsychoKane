import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  MapPin,
  Briefcase,
  Calendar,
  ExternalLink,
  Heart,
  Filter,
  Clock,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Map as MapIcon,
  List as ListIcon,
  Layout,
  Plus,
  ArrowRight,
  CheckCircle,
  XCircle,
  RotateCcw,
  User,
  Home,
  Settings,
  X,
  Key,
  Database,
  BookOpen,
  Phone,
  Globe,
  Building2,
  Zap,
  Car,
  Bus
} from "lucide-react";
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
  useDroppable,
  rectIntersection
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import { generateDuckLogo } from "./services/logoService";
import { DIRECTORY_DATA } from "./constants/directory";

// Fix for Leaflet default icon
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

interface JobOffer {
  id: string;
  title: string;
  company: string;
  location: string;
  source: string;
  url: string;
  date: string;
  salary?: string;
  contractType?: string;
  description?: string;
  lat?: number;
  lng?: number;
  distance?: number;
  isTccMatch?: boolean;
  driveTime?: string;
  transitTime?: string;
  convention?: string;
  estimatedSalary?: string;
}

type ViewMode = "list" | "map" | "crm" | "directory";

type CRMStatus = "A Postuler" | "Postulé" | "A Relancer" | "Entretien" | "Refusé" | "Validé";

interface CRMItem extends JobOffer {
  status: CRMStatus;
  addedAt: number;
}

const HOME_COORDS = { lat: 43.8504, lng: 4.3485 }; // 244 Chemin de Russan, Nîmes

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

// Sortable Item for CRM
const SortableCRMItem: React.FC<{ item: CRMItem, onRemove: (id: string) => void }> = ({ item, onRemove }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 1
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 group relative cursor-grab active:cursor-grabbing hover:border-primary/30 transition-colors"
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(item.id);
        }}
        className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-all z-20"
      >
        <X className="w-3 h-3" />
      </button>

      <div className="relative z-10">
        <div className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">{item.company}</div>
        <h4 className="font-bold text-sm mb-2 line-clamp-2">{item.title}</h4>

        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            <MapPin className="w-3 h-3" />
            {item.distance ? `${item.distance.toFixed(1)}km` : item.location}
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-50">
          <a
            href={item.url}
            target="_blank"
            className="p-1.5 text-gray-400 hover:text-primary transition-colors"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <div className="text-[9px] font-bold text-gray-300 uppercase">
            {new Date(item.addedAt).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
}

// Droppable Column for CRM
const CRMColumn: React.FC<{
  status: CRMStatus,
  items: CRMItem[],
  onRemove: (id: string) => void
}> = ({ status, items, onRemove }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div className="flex-shrink-0 w-[85vw] sm:w-80 flex flex-col gap-4 snap-center">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-2 h-2 rounded-full",
            status === "A Postuler" && "bg-blue-400",
            status === "Postulé" && "bg-yellow-400",
            status === "A Relancer" && "bg-orange-400",
            status === "Entretien" && "bg-purple-400",
            status === "Refusé" && "bg-red-400",
            status === "Validé" && "bg-green-400"
          )} />
          <h3 className="font-bold text-sm text-gray-700">{status}</h3>
        </div>
        <span className="text-[10px] font-bold bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>

      <SortableContext
        id={status}
        items={items.map(i => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className={cn(
            "p-2 rounded-2xl border border-dashed min-h-[500px] space-y-3 transition-all duration-200",
            isOver ? "bg-primary/10 border-primary scale-[1.02]" : "bg-gray-50/50 border-gray-200"
          )}
        >
          {items.map(item => (
            <SortableCRMItem
              key={item.id}
              item={item}
              onRemove={onRemove}
            />
          ))}
          {items.length === 0 && (
            <div className="h-32 flex items-center justify-center text-[10px] text-gray-300 uppercase font-bold tracking-widest">
              Déposer ici
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
};

// Helper component to handle marker clustering
function MarkerClusterGroup({ jobs }: { jobs: JobOffer[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // @ts-ignore
    const mg = L.markerClusterGroup({
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      spiderfyOnMaxZoom: true,
      chunkedLoading: true
    });

    let activePolyline: L.Polyline | null = null;

    jobs.forEach(job => {
      if (job.lat && job.lng) {
        const marker = L.marker([job.lat, job.lng]);
        marker.bindPopup(`
          <div class="p-2 min-w-[200px]">
            <div class="text-[10px] font-bold text-[#F0C5D5] uppercase mb-1">${job.source}</div>
            <h4 class="font-bold text-sm mb-1">${job.title}</h4>
            <div class="text-xs text-gray-600 mb-2">${job.company}</div>
            <div class="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
              <span class="text-[10px] text-gray-400">${job.contractType || ''}</span>
              <a href="${job.url}" target="_blank" class="text-[10px] font-bold text-[#F0C5D5] flex items-center gap-1">
                VOIR L'OFFRE <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
              </a>
            </div>
          </div>
        `);

        marker.on('mouseover', () => {
          if (!activePolyline) {
            activePolyline = L.polyline([[HOME_COORDS.lat, HOME_COORDS.lng], [job.lat!, job.lng!]], {
              color: '#3B82F6',
              weight: 3,
              opacity: 0.6,
              dashArray: '8, 8'
            }).addTo(map);
          }
        });
        marker.on('mouseout', () => {
          if (activePolyline) {
            map.removeLayer(activePolyline);
            activePolyline = null;
          }
        });

        mg.addLayer(marker);
      }
    });

    // Add Home Marker
    const homeIcon = L.divIcon({
      html: `<div class="bg-secondary p-1.5 rounded-full border-2 border-white shadow-lg text-white"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg></div>`,
      className: 'home-marker',
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });
    const homeMarker = L.marker([HOME_COORDS.lat, HOME_COORDS.lng], { icon: homeIcon });
    homeMarker.bindPopup('<div class="font-bold text-center">Mon Domicile<br/><span class="text-[10px] font-normal text-gray-500">244 Chemin de Russan</span></div>');
    map.addLayer(homeMarker);

    map.addLayer(mg);

    return () => {
      map.removeLayer(mg);
    };
  }, [map, jobs]);

  return null;
}

export default function App() {
  const [jobs, setJobs] = useState<JobOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [crmItems, setCrmItems] = useState<CRMItem[]>(() => {
    const saved = localStorage.getItem("psychologue_scout_crm");
    return saved ? JSON.parse(saved) : [];
  });
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem("psychologue_scout_favorites");
    return saved ? JSON.parse(saved) : [];
  });
  const [lastVisit, setLastVisit] = useState<number>(() => {
    const saved = localStorage.getItem("psychologue_scout_last_visit");
    return saved ? parseInt(saved) : Date.now();
  });

  // Filters
  const [contractFilter, setContractFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [radius, setRadius] = useState(20);
  const [showOnlyNew, setShowOnlyNew] = useState(false);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>("/duck_logo.png");
  const [hasKey, setHasKey] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobOffer | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // API Keys from LocalStorage
  const [apiKeys, setApiKeys] = useState({
    serpApi: localStorage.getItem("serp_api_key") || "",
    ftClientId: localStorage.getItem("ft_client_id") || "",
    ftClientSecret: localStorage.getItem("ft_client_secret") || ""
  });

  const saveApiKeys = (keys: typeof apiKeys) => {
    setApiKeys(keys);
    localStorage.setItem("serp_api_key", keys.serpApi);
    localStorage.setItem("ft_client_id", keys.ftClientId);
    localStorage.setItem("ft_client_secret", keys.ftClientSecret);
  };

  const checkKey = async () => {
    if (window.aistudio?.hasSelectedApiKey) {
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasKey(selected);
    }
  };

  const handleOpenKeyDialog = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasKey(true); // Assume success as per guidelines
      fetchJobs();
      loadLogo();
    }
  };

  const loadLogo = async () => {
    const url = await generateDuckLogo();
    if (url) setLogoUrl(url);
  };

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/jobs?radius=${radius}`, {
        headers: {
          "x-serp-api-key": apiKeys.serpApi,
          "x-ft-client-id": apiKeys.ftClientId,
          "x-ft-client-secret": apiKeys.ftClientSecret
        }
      });
      if (!response.ok) throw new Error("Erreur lors de la récupération des offres");
      const data = await response.json();

      // Calculate distances
      const jobsWithDistance = data.map((job: any) => {
        if (job.lat && job.lng) {
          return {
            ...job,
            distance: calculateDistance(HOME_COORDS.lat, HOME_COORDS.lng, job.lat, job.lng)
          };
        }
        return job;
      });

      console.log("Jobs received from API:", jobsWithDistance.length);
      setJobs(jobsWithDistance);
      localStorage.setItem("psychologue_scout_last_visit", Date.now().toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkKey();
    loadLogo();
    fetchJobs(); // Initial fetch
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchJobs();
    }, 800); // Debounce fetch
    return () => clearTimeout(timer);
  }, [radius]);

  useEffect(() => {
    localStorage.setItem("psychologue_scout_favorites", JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem("psychologue_scout_crm", JSON.stringify(crmItems));
  }, [crmItems]);

  const addToCRM = (job: JobOffer) => {
    if (crmItems.find(item => item.id === job.id)) return;
    const newItem: CRMItem = {
      ...job,
      status: "A Postuler",
      addedAt: Date.now()
    };
    setCrmItems(prev => [...prev, newItem]);
    // Optional: Switch to CRM view or show toast
  };

  const updateCRMStatus = (id: string, newStatus: CRMStatus) => {
    setCrmItems(prev => prev.map(item =>
      item.id === id ? { ...item, status: newStatus } : item
    ));
  };

  const removeFromCRM = (id: string) => {
    setCrmItems(prev => prev.filter(item => item.id !== id));
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeItem = crmItems.find(i => i.id === active.id);
    if (!activeItem) return;

    // Check if we're dragging over a column or an item in a column
    const overId = over.id as string;
    const overItem = crmItems.find(i => i.id === overId);

    const statuses: CRMStatus[] = ["A Postuler", "Postulé", "A Relancer", "Entretien", "Refusé", "Validé"];
    const overStatus = statuses.includes(overId as CRMStatus) ? overId as CRMStatus : overItem?.status;

    if (overStatus && activeItem.status !== overStatus) {
      setCrmItems(prev => prev.map(item =>
        item.id === active.id ? { ...item, status: overStatus } : item
      ));
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    if (active.id !== over.id) {
      const activeIndex = crmItems.findIndex(i => i.id === active.id);
      const overIndex = crmItems.findIndex(i => i.id === over.id);

      if (overIndex !== -1) {
        setCrmItems(prev => arrayMove(prev, activeIndex, overIndex));
      }
    }
  };

  const toggleFavorite = (id: string) => {
    setFavorites(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const matchesContract = contractFilter === "all" || job.contractType?.includes(contractFilter);
      const matchesSource = sourceFilter === "all" || job.source === sourceFilter;
      const matchesNew = !showOnlyNew || new Date(job.date).getTime() > lastVisit;
      const matchesFavorites = !showOnlyFavorites || favorites.includes(job.id);

      return matchesContract && matchesSource && matchesNew && matchesFavorites;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [jobs, contractFilter, sourceFilter, showOnlyNew, showOnlyFavorites, favorites, lastVisit]);

  const sources = Array.from(new Set(jobs.map(j => j.source)));

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-primary p-1.5 rounded-xl shadow-sm">
              <img src={logoUrl} alt="Logo" className="w-10 h-10 object-contain" referrerPolicy="no-referrer" />
            </div>
            <h1 className="text-2xl font-black tracking-tighter hidden sm:block">
              <span className="text-primary">Psycho</span><span className="text-secondary">Kane</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 p-1 rounded-xl mr-2">
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-lg transition-all ${viewMode === "list" ? 'bg-white shadow-sm text-primary' : 'text-gray-400 hover:text-gray-600'}`}
                title="Vue Liste"
              >
                <ListIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={`p-1.5 rounded-lg transition-all ${viewMode === "map" ? 'bg-white shadow-sm text-primary' : 'text-gray-400 hover:text-gray-600'}`}
                title="Vue Carte"
              >
                <MapIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("crm")}
                className={`p-1.5 rounded-lg transition-all ${viewMode === "crm" ? 'bg-white shadow-sm text-primary' : 'text-gray-400 hover:text-gray-600'}`}
                title="Vue CRM"
              >
                <Layout className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("directory")}
                className={`p-1.5 rounded-lg transition-all ${viewMode === "directory" ? 'bg-white shadow-sm text-primary' : 'text-gray-400 hover:text-gray-600'}`}
                title="Annuaire"
              >
                <BookOpen className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={fetchJobs}
              disabled={loading}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
              title="Paramètres API de scraping"
            >
              <Settings className="w-5 h-5" />
            </button>

            <div className="h-8 w-px bg-gray-200 mx-2 hidden sm:block" />

            <button
              onClick={handleOpenKeyDialog}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold transition-all ${!hasKey
                ? 'bg-primary/20 text-primary border border-primary/30 animate-pulse'
                : 'bg-gray-50 text-gray-400 border border-transparent hover:bg-gray-100'
                }`}
              title="Configurer la clé Gemini (Logo)"
            >
              <Key className="w-4 h-4" />
              <span className="hidden md:inline">{!hasKey ? 'Gemini' : 'Gemini'}</span>
            </button>

            <button
              onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${showOnlyFavorites
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'bg-gray-50 text-gray-600 border border-transparent hover:bg-gray-100'
                }`}
            >
              <Heart className={`w-4 h-4 ${showOnlyFavorites ? 'fill-current' : ''}`} />
              <span className="hidden sm:inline">Favoris ({favorites.length})</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

          {/* Sidebar Filters */}
          <aside className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-6">
                <Filter className="w-4 h-4 text-primary" />
                <h2 className="font-semibold">Filtres</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Rayon de recherche</label>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="5"
                      max="30"
                      step="5"
                      value={radius}
                      onChange={(e) => setRadius(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      <span>5km</span>
                      <span className="text-primary">{radius}km</span>
                      <span>30km</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Type de contrat</label>
                  <select
                    value={contractFilter}
                    onChange={(e) => setContractFilter(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  >
                    <option value="all">Tous les types</option>
                    <option value="CDI">CDI</option>
                    <option value="CDD">CDD</option>
                    <option value="Vacataire">Vacataire</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Source</label>
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  >
                    <option value="all">Toutes les sources</option>
                    {sources.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={showOnlyNew}
                      onChange={(e) => setShowOnlyNew(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-secondary focus:ring-secondary"
                    />
                    <span className="text-sm font-medium text-gray-600 group-hover:text-gray-900 transition-colors">Nouveautés uniquement</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Stats Card */}
            <div className="bg-primary p-6 rounded-2xl text-gray-900">
              <h3 className="text-gray-900/60 text-xs font-bold uppercase tracking-widest mb-4">Statistiques</h3>
              <div className="space-y-4">
                <div>
                  <div className="text-3xl font-light">{filteredJobs.length}</div>
                  <div className="text-gray-900/40 text-xs mt-1">Offres trouvées</div>
                </div>
                <div className="h-px bg-gray-900/10" />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-900/40">Rayon</span>
                  <span className="text-xs font-medium">{radius} km autour de Nîmes</span>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">
                  Dernière mise à jour : {formatDistanceToNow(lastVisit, { addSuffix: true, locale: fr })}
                </span>
              </div>
            </div>

            {viewMode === "directory" ? (
              <div className="space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                      <BookOpen className="w-6 h-6 text-primary" />
                      Annuaire des Établissements
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">
                      Liste des institutions et cliniques pertinentes pour votre recherche à Nîmes.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-12">
                  {DIRECTORY_DATA.map((category, catIdx) => (
                    <section key={catIdx} className="space-y-6">
                      <div className="flex items-center gap-4">
                        <div className="h-px bg-gray-200 flex-1" />
                        <div className="text-center px-4">
                          <h3 className="font-black text-xs uppercase tracking-[0.2em] text-gray-400">
                            {category.title}
                          </h3>
                        </div>
                        <div className="h-px bg-gray-200 flex-1" />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {category.entries.map((entry, entryIdx) => (
                          <motion.div
                            key={entryIdx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: entryIdx * 0.05 }}
                            className="bg-white p-6 rounded-2xl border border-gray-100 hover:border-primary/30 hover:shadow-lg transition-all group"
                          >
                            <div className="flex items-start justify-between gap-4 mb-4">
                              <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-primary/10 transition-colors">
                                <Building2 className="w-5 h-5 text-gray-400 group-hover:text-primary" />
                              </div>
                              <div className="flex-1">
                                <h4 className="font-bold text-gray-900 leading-tight">{entry.name}</h4>
                                <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                                  <MapPin className="w-3 h-3" />
                                  {entry.address}
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-4 border-t border-gray-50">
                              <a
                                href={`tel:${entry.phone.replace(/\s/g, '')}`}
                                className="flex items-center justify-center gap-2 py-2 bg-gray-50 hover:bg-primary/10 text-gray-600 hover:text-primary rounded-xl text-xs font-bold transition-all"
                              >
                                <Phone className="w-3.5 h-3.5" />
                                Appeler
                              </a>
                              {entry.website ? (
                                <a
                                  href={entry.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-center gap-2 py-2 bg-gray-50 hover:bg-secondary/10 text-gray-600 hover:text-secondary rounded-xl text-xs font-bold transition-all"
                                >
                                  <Globe className="w-3.5 h-3.5" />
                                  Site Web
                                </a>
                              ) : (
                                <div className="flex items-center justify-center gap-2 py-2 bg-gray-50 text-gray-400 rounded-xl text-[10px] font-bold uppercase">
                                  {entry.contact}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            ) : viewMode === "crm" ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Layout className="w-5 h-5 text-primary" />
                    Suivi des candidatures (CRM)
                  </h2>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-widest">
                    {crmItems.length} candidatures au total
                  </div>
                </div>

                <DndContext
                  sensors={sensors}
                  collisionDetection={rectIntersection}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                >
                  <div className="h-full pt-6">
                    <div className="flex gap-4 overflow-x-auto pb-6 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide snap-x snap-mandatory">
                      {(["A Postuler", "Postulé", "A Relancer", "Entretien", "Refusé", "Validé"] as CRMStatus[]).map(status => (
                        <CRMColumn
                          key={status}
                          status={status}
                          items={crmItems.filter(i => i.status === status)}
                          onRemove={removeFromCRM}
                        />
                      ))}
                    </div>
                  </div>

                  <DragOverlay dropAnimation={{
                    sideEffects: defaultDropAnimationSideEffects({
                      styles: {
                        active: {
                          opacity: '0.5',
                        },
                      },
                    }),
                  }}>
                    {activeId ? (
                      <div className="bg-white p-4 rounded-xl shadow-xl border border-primary/20 w-[85vw] sm:w-80 rotate-3 scale-105">
                        <div className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1">
                          {crmItems.find(i => i.id === activeId)?.company}
                        </div>
                        <h4 className="font-bold text-sm mb-2">
                          {crmItems.find(i => i.id === activeId)?.title}
                        </h4>
                        <div className="flex items-center gap-1 text-[10px] text-gray-400">
                          <MapPin className="w-3 h-3" />
                          {crmItems.find(i => i.id === activeId)?.distance?.toFixed(1)}km
                        </div>
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>
              </div>
            ) : viewMode === "map" ? (
              <div className="bg-white p-2 rounded-2xl border border-gray-100 shadow-sm h-[600px] relative overflow-hidden">
                {loading ? (
                  <div className="absolute inset-0 z-10 bg-white/80 flex items-center justify-center backdrop-blur-sm">
                    <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                  </div>
                ) : (
                  <MapContainer
                    center={[43.8367, 4.3601]}
                    zoom={12}
                    className="w-full h-full rounded-xl"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MarkerClusterGroup jobs={filteredJobs} />
                  </MapContainer>
                )}
                <div className="absolute bottom-4 right-4 z-[1000] bg-white px-3 py-1.5 rounded-lg shadow-lg border border-gray-100 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  {filteredJobs.length} marqueurs affichés
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 animate-pulse">
                        <div className="h-6 bg-gray-100 rounded w-1/3 mb-4" />
                        <div className="h-4 bg-gray-100 rounded w-1/4 mb-2" />
                        <div className="h-4 bg-gray-100 rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                ) : error ? (
                  <div className="bg-primary/10 border border-primary/20 p-8 rounded-2xl text-center">
                    <AlertCircle className="w-12 h-12 text-primary mx-auto mb-4" />
                    <h3 className="text-gray-900 font-semibold mb-2">Oups ! Une erreur est survenue</h3>
                    <p className="text-gray-600 text-sm mb-6">{error}</p>
                    <button
                      onClick={fetchJobs}
                      className="px-6 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:opacity-90 transition-colors"
                    >
                      Réessayer
                    </button>
                  </div>
                ) : filteredJobs.length === 0 ? (
                  <div className="bg-white border border-gray-100 p-12 rounded-3xl text-center shadow-sm">
                    <div className="w-20 h-20 bg-primary/5 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Search className="w-10 h-10 text-primary/30" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Aucune offre trouvée</h3>
                    <p className="text-gray-500 text-sm max-w-xs mx-auto mb-8">
                      Nous n'avons trouvé aucune annonce de psychologue dans un rayon de {radius}km autour de Nîmes.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                      <button
                        onClick={() => fetchJobs()}
                        className="w-full sm:w-auto px-8 py-3 bg-gray-900 text-white rounded-2xl font-bold hover:bg-primary hover:text-gray-900 transition-all shadow-lg shadow-gray-900/10 flex items-center justify-center gap-2"
                      >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Actualiser
                      </button>
                      <button
                        onClick={() => setShowSettings(true)}
                        className="w-full sm:w-auto px-8 py-3 bg-white text-gray-900 border border-gray-200 rounded-2xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                      >
                        <Settings className="w-4 h-4" />
                        Vérifier les clés API
                      </button>
                    </div>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {filteredJobs.map((job) => (
                      <motion.div
                        key={job.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="group bg-white p-6 rounded-2xl border border-gray-100 hover:border-secondary/30 hover:shadow-xl hover:shadow-secondary/5 transition-all duration-300 relative overflow-hidden"
                      >
                        {/* New Badge */}
                        {new Date(job.date).getTime() > lastVisit && (
                          <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                        )}

                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-wider rounded">
                                {job.source}
                              </span>
                              {new Date(job.date).getTime() > lastVisit && (
                                <span className="px-2 py-0.5 bg-primary/20 text-primary text-[10px] font-bold uppercase tracking-wider rounded">
                                  Nouveau
                                </span>
                              )}
                              {job.isTccMatch && (
                                <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-100 uppercase tracking-wider">
                                  <Zap size={12} /> TCC
                                </span>
                              )}
                            </div>

                            <h3 className="text-lg font-bold text-gray-900 group-hover:text-secondary transition-colors">
                              {job.title}
                            </h3>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
                              <div className="flex items-center gap-1.5">
                                <Briefcase className="w-4 h-4" />
                                <span className="font-medium text-gray-700">{job.company}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <MapPin className="w-4 h-4" />
                                <span>{job.location}</span>
                                {job.distance !== undefined && (
                                  <span className="text-secondary font-bold ml-1">
                                    ({job.distance.toFixed(1)}km)
                                  </span>
                                )}
                              </div>
                              {job.contractType && (
                                <div className="flex items-center gap-1.5">
                                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                  <span>{job.contractType}</span>
                                </div>
                              )}
                              {job.driveTime && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1.5 text-xs bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                                  <Car className="w-3.5 h-3.5 text-gray-400" />
                                  <span>{job.driveTime}</span>
                                </motion.div>
                              )}
                              {job.transitTime && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1.5 text-xs bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                                  <Bus className="w-3.5 h-3.5 text-gray-400" />
                                  <span>{job.transitTime}</span>
                                </motion.div>
                              )}
                              {job.estimatedSalary && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded-[4px] border border-green-200 cursor-help" title={`Basé sur ${job.convention || 'une convention inconnue'} pour un profil débutant.`}>
                                  <span>≈ {job.estimatedSalary}</span>
                                </motion.div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-start">
                            <button
                              onClick={() => addToCRM(job)}
                              disabled={!!crmItems.find(i => i.id === job.id)}
                              className={cn(
                                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm",
                                !!crmItems.find(i => i.id === job.id)
                                  ? "bg-green-50 text-green-600 border border-green-100 cursor-default"
                                  : "bg-white border border-gray-100 text-gray-600 hover:border-primary/30 hover:text-primary"
                              )}
                            >
                              {!!crmItems.find(i => i.id === job.id) ? (
                                <>
                                  <CheckCircle className="w-4 h-4" />
                                  Dans CRM
                                </>
                              ) : (
                                <>
                                  <Plus className="w-4 h-4" />
                                  CRM
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => toggleFavorite(job.id)}
                              className={`p-2.5 rounded-xl border transition-all ${favorites.includes(job.id)
                                ? 'bg-primary/20 border-primary/30 text-primary'
                                : 'bg-white border-gray-100 text-gray-400 hover:border-primary/30 hover:text-primary'
                                }`}
                            >
                              <Heart className={`w-5 h-5 ${favorites.includes(job.id) ? 'fill-current' : ''}`} />
                            </button>
                            <a
                              href={job.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-gray-900 rounded-xl text-sm font-bold hover:bg-secondary transition-all shadow-lg shadow-primary/10"
                            >
                              Voir l'annonce
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-gray-50 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            {job.salary && (
                              <div className="text-sm font-medium text-primary bg-primary/20 px-3 py-1 rounded-lg">
                                {job.salary}
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(job.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                            </div>
                          </div>

                          <button
                            onClick={() => setSelectedJob(job)}
                            className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1 hover:text-primary transition-colors"
                          >
                            Détails <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Details Modal */}
      <AnimatePresence>
        {selectedJob && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedJob(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/20 rounded-xl text-primary font-bold text-xs uppercase tracking-widest">
                    {selectedJob.source}
                  </div>
                  <h2 className="font-bold text-gray-900 line-clamp-1">{selectedJob.title}</h2>
                </div>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="p-2 hover:bg-white rounded-full transition-colors text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Entreprise</p>
                    <p className="font-semibold text-gray-900">{selectedJob.company}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Lieu</p>
                    <p className="font-semibold text-gray-900">{selectedJob.location}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Contrat</p>
                    <p className="font-semibold text-gray-900">{selectedJob.contractType || "Non spécifié"}</p>
                  </div>
                </div>

                {selectedJob.salary && (
                  <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Rémunération</p>
                    <p className="font-bold text-gray-900">{selectedJob.salary}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Description du poste</p>
                  <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {selectedJob.description || "Aucune description détaillée disponible pour cette offre."}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-4">
                <button
                  onClick={() => {
                    addToCRM(selectedJob);
                    setSelectedJob(null);
                  }}
                  disabled={!!crmItems.find(i => i.id === selectedJob.id)}
                  className={cn(
                    "px-6 py-3 rounded-2xl font-bold transition-all",
                    !!crmItems.find(i => i.id === selectedJob.id)
                      ? "bg-green-50 text-green-600 border border-green-100"
                      : "bg-white border border-gray-200 text-gray-900 hover:border-primary"
                  )}
                >
                  {!!crmItems.find(i => i.id === selectedJob.id) ? "Déjà dans le CRM" : "Ajouter au CRM"}
                </button>
                <a
                  href={selectedJob.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-8 py-3 bg-primary text-gray-900 rounded-2xl font-bold hover:bg-secondary transition-all shadow-lg shadow-primary/10 flex items-center gap-2"
                >
                  Voir l'annonce complète
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-primary/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/20 rounded-xl text-primary">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-gray-900">Configuration Scraping</h2>
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">API Externes</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 hover:bg-white rounded-full transition-colors text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block flex items-center gap-2">
                      <Search className="w-3 h-3" /> SerpApi Key (Google Jobs)
                    </label>
                    <input
                      type="password"
                      placeholder="Votre clé SerpApi..."
                      value={apiKeys.serpApi}
                      onChange={(e) => saveApiKeys({ ...apiKeys, serpApi: e.target.value })}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    />
                    <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">
                      Nécessaire pour récupérer les offres depuis Google Jobs.
                    </p>
                  </div>

                  <div className="h-px bg-gray-100" />

                  <div className="space-y-4">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block flex items-center gap-2">
                      <Briefcase className="w-3 h-3" /> France Travail API
                    </label>
                    <div>
                      <input
                        type="text"
                        placeholder="Client ID..."
                        value={apiKeys.ftClientId}
                        onChange={(e) => saveApiKeys({ ...apiKeys, ftClientId: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all mb-2"
                      />
                      <input
                        type="password"
                        placeholder="Client Secret..."
                        value={apiKeys.ftClientSecret}
                        onChange={(e) => saveApiKeys({ ...apiKeys, ftClientSecret: e.target.value })}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-secondary/10 p-4 rounded-2xl border border-secondary/20">
                  <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-secondary shrink-0" />
                    <p className="text-xs text-secondary-dark leading-relaxed">
                      Ces clés sont stockées localement dans votre navigateur. Elles sont envoyées au serveur uniquement pour effectuer les recherches.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowSettings(false);
                    fetchJobs();
                  }}
                  className="w-full py-3 bg-gray-900 text-white rounded-2xl font-bold hover:bg-primary hover:text-gray-900 transition-all shadow-lg shadow-gray-900/10"
                >
                  Enregistrer et Actualiser
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-gray-400">
            © 2024 PsychoKane Nîmes. Données agrégées depuis France Travail, Google Jobs et Choisir le Service Public.
          </p>
        </div>
      </footer>
    </div>
  );
}
