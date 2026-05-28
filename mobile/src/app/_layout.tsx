import { Stack, usePathname, useRouter } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Font from "expo-font";
import { Animated, Dimensions, PanResponder, View } from "react-native";
import MaterialSymbolsOutlined from "../../assets/fonts/MaterialSymbolsOutlined.ttf";
import HankenGrotesk from "../../assets/fonts/HankenGrotesk[wght].ttf";
import InterFont from "../../assets/fonts/Inter[opsz,wght].ttf";
import JetBrainsMono from "../../assets/fonts/JetBrainsMono[wght].ttf";
import FloatingBottomNav from "../components/FloatingBottomNav";
import AdvisorFab from "../components/AdvisorFab";
import { AppBootstrapSkeleton } from "../components/LoadingSkeleton";
import { CurrencyProvider, DEFAULT_CURRENCY_CODE, normalizeCurrencyCode } from "../providers/CurrencyProvider";
import { UserProfileProvider } from "../providers/UserProfileProvider";
import { API_BASE_URL } from "../lib/apiBaseUrl";
import { shouldStartAppSwipe } from "../lib/horizontalScrollPriority";
import { fetchCachedValue } from "../lib/clientCache";

const MAIN_ROUTES = ["/", "/transactions", "/goals", "/settings"] as const;

function routeIndex(route: string) {
  const index = MAIN_ROUTES.indexOf(route as (typeof MAIN_ROUTES)[number]);
  return index >= 0 ? index : 0;
}

function routeAtIndex(index: number) {
  return MAIN_ROUTES[Math.max(0, Math.min(MAIN_ROUTES.length - 1, index))];
}

function mainRouteForPath(pathname: string) {
  if (pathname === "/") return "/";
  if (pathname.startsWith("/transactions") || pathname.startsWith("/subscriptions") || pathname.startsWith("/insights")) return "/transactions";
  if (pathname.startsWith("/goals") || pathname.startsWith("/simulation")) return "/goals";
  if (pathname.startsWith("/settings")) return "/settings";
  return null;
}

type SwipeHandlerSet = {
  beginSwipe: (startX: number, startY: number) => void;
  updateSwipe: (dx: number, dy: number) => void;
  handleSwipeEnd: (dx: number, vx: number) => void;
};

const swipeHandlerSet: SwipeHandlerSet = {
  beginSwipe: () => { },
  updateSwipe: () => { },
  handleSwipeEnd: () => { },
};

const APP_SWIPE_HANDLERS = PanResponder.create({
  onStartShouldSetPanResponder: () => false,
  onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 4 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 0.6 && shouldStartAppSwipe(gestureState.dx, gestureState.dy),
  onPanResponderGrant: (_, gestureState) => {
    swipeHandlerSet.beginSwipe(gestureState.x0, gestureState.y0);
  },
  onPanResponderMove: (_, gestureState) => {
    swipeHandlerSet.updateSwipe(gestureState.dx, gestureState.dy);
  },
  onPanResponderRelease: (_, gestureState) => {
    swipeHandlerSet.handleSwipeEnd(gestureState.dx, gestureState.vx);
  },
  onPanResponderTerminate: (_, gestureState) => {
    swipeHandlerSet.handleSwipeEnd(gestureState.dx, gestureState.vx);
  },
  onPanResponderTerminationRequest: () => false,
  onShouldBlockNativeResponder: () => false,
}).panHandlers;

type ProfilePayload = {
  profile?: {
    ownerName?: string | null;
    currency?: string | null;
  };
  ok?: boolean;
  error?: string;
};

async function fetchProfile(force = false) {
  return fetchCachedValue(
    "app:profile-summary",
    async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/profile`);
        const payload = (await response.json()) as ProfilePayload;
        if (!response.ok || payload.ok === false) {
          return { currencyCode: DEFAULT_CURRENCY_CODE, ownerName: "" };
        }
        return {
          currencyCode: normalizeCurrencyCode(payload.profile?.currency),
          ownerName: payload.profile?.ownerName ?? "",
        };
      } catch {
        return { currencyCode: DEFAULT_CURRENCY_CODE, ownerName: "" };
      }
    },
    { force },
  );
}

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [currencyCode, setCurrencyCode] = useState(DEFAULT_CURRENCY_CODE);
  const [ownerName, setOwnerName] = useState("");
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [swipeTranslateX] = useState(() => new Animated.Value(0));
  const swipeAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const gestureStateRef = useRef({ startIndex: 0, active: false, direction: 0 as -1 | 0 | 1, pendingRoute: null as string | null });
  const touchStateRef = useRef({ startX: 0, startY: 0, lastDx: 0, lastDy: 0, active: false, startIndex: 0 });
  const swipeStartTimeRef = useRef(0);
  const activeRoute = mainRouteForPath(pathname) ?? "/";
  const activeIndex = useMemo(() => routeIndex(activeRoute), [activeRoute]);

  useEffect(() => {
    if (!gestureStateRef.current.active && !gestureStateRef.current.pendingRoute) {
      void activeIndex;
    }
  }, [activeIndex]);

  useEffect(() => {
    if (!gestureStateRef.current.pendingRoute) return;
    if (mainRouteForPath(pathname) !== gestureStateRef.current.pendingRoute) return;

    swipeTranslateX.setValue(-gestureStateRef.current.direction * Dimensions.get("window").width);
    swipeAnimation.current?.stop();
    swipeAnimation.current = Animated.timing(swipeTranslateX, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    });
    swipeAnimation.current.start(() => {
      gestureStateRef.current.pendingRoute = null;
      gestureStateRef.current.active = false;
      gestureStateRef.current.direction = 0;
    });
  }, [pathname, swipeTranslateX]);

  const runSwipeNavigation = useCallback((direction: -1 | 1) => {
    const currentIndex = routeIndex(mainRouteForPath(pathname) ?? "/");
    const nextIndex = Math.max(0, Math.min(MAIN_ROUTES.length - 1, currentIndex + direction));
    if (nextIndex === currentIndex) {
      swipeAnimation.current?.stop();
      swipeAnimation.current = Animated.spring(swipeTranslateX, {
        toValue: 0,
        damping: 18,
        stiffness: 220,
        mass: 0.8,
        useNativeDriver: true,
      });
      swipeAnimation.current.start();
      gestureStateRef.current.active = false;
      gestureStateRef.current.direction = 0;
      return;
    }

    const nextRoute = routeAtIndex(nextIndex);
    gestureStateRef.current.pendingRoute = nextRoute;
    gestureStateRef.current.direction = direction;
    swipeAnimation.current?.stop();
    swipeAnimation.current = Animated.timing(swipeTranslateX, {
      toValue: -direction * Dimensions.get("window").width,
      duration: 180,
      useNativeDriver: true,
    });
    swipeAnimation.current.start(() => {
      router.replace(nextRoute);
    });
  }, [pathname, router, swipeTranslateX]);

  const beginSwipe = useCallback((startX: number, startY: number) => {
    swipeAnimation.current?.stop();
    swipeStartTimeRef.current = Date.now();
    const startIndex = routeIndex(mainRouteForPath(pathname) ?? "/");
    gestureStateRef.current.startIndex = startIndex;
    gestureStateRef.current.active = false;
    gestureStateRef.current.direction = 0;
    gestureStateRef.current.pendingRoute = null;
    touchStateRef.current = {
      startX,
      startY,
      lastDx: 0,
      lastDy: 0,
      active: false,
      startIndex,
    };
  }, [pathname]);

  const updateSwipe = useCallback((dx: number, dy: number) => {
    const state = gestureStateRef.current;
    const touchState = touchStateRef.current;

    touchState.lastDx = dx;
    touchState.lastDy = dy;

    if (!state.active) {
      if (Math.abs(dx) <= 4 || Math.abs(dx) <= Math.abs(dy) * 0.6) return;
      state.active = true;
      gestureStateRef.current.active = true;
      gestureStateRef.current.pendingRoute = null;
      touchState.active = true;
    }

    if (!gestureStateRef.current.active) return;

    const width = Dimensions.get("window").width;
    const rawDirection = dx < 0 ? 1 : -1;
    const targetIndex = Math.max(0, Math.min(MAIN_ROUTES.length - 1, state.startIndex + rawDirection));
    const canMove = targetIndex !== state.startIndex;
    const translated = dx * (canMove ? 1 : 0.18);
    swipeTranslateX.setValue(translated);
    gestureStateRef.current.direction = canMove ? rawDirection : 0;

    const progress = Math.min(1, Math.abs(translated) / width);
    void progress;
  }, [swipeTranslateX]);

  const settleSwipe = useCallback((shouldNavigate: boolean) => {
    if (shouldNavigate) {
      runSwipeNavigation(gestureStateRef.current.direction || (touchStateRef.current.lastDx < 0 ? 1 : -1));
      return;
    }

    gestureStateRef.current.active = false;
    gestureStateRef.current.direction = 0;
    swipeAnimation.current?.stop();
    swipeAnimation.current = Animated.spring(swipeTranslateX, {
      toValue: 0,
      damping: 18,
      stiffness: 220,
      mass: 0.8,
      useNativeDriver: true,
    });
    swipeAnimation.current.start(() => {
      void routeIndex(mainRouteForPath(pathname) ?? "/");
    });
  }, [pathname, runSwipeNavigation, swipeTranslateX]);

  const handleSwipeEnd = useCallback((dx: number, vx: number) => {
    const { startIndex } = gestureStateRef.current;
    const direction = dx < 0 ? 1 : -1;
    const candidateIndex = Math.max(0, Math.min(MAIN_ROUTES.length - 1, startIndex + direction));
    const elapsed = Date.now() - swipeStartTimeRef.current;
    const horizontalEnough = Math.abs(dx) > Math.abs(touchStateRef.current.lastDy) * 0.6;
    const shouldNavigate = candidateIndex !== startIndex && horizontalEnough && (Math.abs(dx) > 4 || Math.abs(vx) > 0.2 || elapsed < 260);

    gestureStateRef.current.active = false;
    touchStateRef.current.active = false;
    settleSwipe(shouldNavigate);
  }, [settleSwipe]);

  useEffect(() => {
    swipeHandlerSet.beginSwipe = beginSwipe;
    swipeHandlerSet.updateSwipe = updateSwipe;
    swipeHandlerSet.handleSwipeEnd = handleSwipeEnd;
  }, [beginSwipe, handleSwipeEnd, updateSwipe]);

  const loadFonts = useCallback(async () => {
    try {
      await Font.loadAsync({
        "Material Symbols Outlined": MaterialSymbolsOutlined,
        "Hanken Grotesk": HankenGrotesk,
        Inter: InterFont,
        "JetBrains Mono": JetBrainsMono,
      });
    } catch {
      // ignore errors loading the font — fall back to system font
    } finally {
      setFontsLoaded(true);
      // Expose a global flag so screens can conditionally use the font family
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        global.MATERIAL_SYMBOLS_LOADED = true;
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    void loadFonts();
  }, [loadFonts]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const nextProfile = await fetchProfile();
      if (!mounted) return;
      setCurrencyCode(nextProfile.currencyCode);
      setOwnerName(nextProfile.ownerName);
      setProfileLoaded(true);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (!fontsLoaded || !profileLoaded) {
    return (
      <SafeAreaProvider>
        <AppBootstrapSkeleton />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <CurrencyProvider initialCurrencyCode={currencyCode}>
        <UserProfileProvider initialOwnerName={ownerName}>
          <View style={{ flex: 1, backgroundColor: "#131313" }}>
            <View style={{ flex: 1, backgroundColor: "#131313" }} {...APP_SWIPE_HANDLERS}>
              <Animated.View style={{ flex: 1, backgroundColor: "#131313", transform: [{ translateX: swipeTranslateX }] }}>
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#131313" } }} />
              </Animated.View>
            </View>
            <FloatingBottomNav />
            <AdvisorFab />
          </View>
        </UserProfileProvider>
      </CurrencyProvider>
    </SafeAreaProvider>
  );
}
