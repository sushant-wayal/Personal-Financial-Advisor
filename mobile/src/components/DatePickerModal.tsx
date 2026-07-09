import React, { useState, useMemo, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";

export function toDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseDateKey(value?: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function fullDateLabel(value?: string | null) {
  const date = parseDateKey(value);
  if (!date) return "Select date";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function monthTitle(date: Date) {
  return new Intl.DateTimeFormat("en-US", { month: "long" }).format(date);
}

function buildCalendarDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const start = new Date(year, month, 1 - firstOfMonth.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return {
      key: toDateKey(date),
      day: date.getDate(),
      inMonth: date.getMonth() === month,
    };
  });
}

export function compareDateKeys(a?: string | null, b?: string | null) {
  if (!a || !b) return 0;
  return a.localeCompare(b);
}

type ViewMode = "calendar" | "month" | "year";

export function DatePickerModal({
  visible,
  initialDate,
  onClose,
  onSelect,
  disablePast = false,
  disableFuture = false,
  withTime = false,
  initialHour = "12",
  initialMinute = "00",
}: {
  visible: boolean;
  initialDate?: string | null;
  onClose: () => void;
  onSelect: (dateKey: string, hour?: string, minute?: string) => void;
  disablePast?: boolean;
  disableFuture?: boolean;
  withTime?: boolean;
  initialHour?: string;
  initialMinute?: string;
}) {
  const todayKey = toDateKey(new Date());
  const [dateDraft, setDateDraft] = useState(initialDate || todayKey);
  const [dateMonth, setDateMonth] = useState(() => {
    const date = parseDateKey(initialDate) || new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [hourDraft, setHourDraft] = useState(initialHour);
  const [minuteDraft, setMinuteDraft] = useState(initialMinute);

  const hourOptions = useMemo(() => {
    let maxHour = 23;
    if (disableFuture && dateDraft === todayKey) {
      maxHour = new Date().getHours();
    }
    return Array.from({ length: maxHour + 1 }, (_, i) => String(i).padStart(2, "0"));
  }, [disableFuture, dateDraft]);

  const minuteOptions = useMemo(() => {
    let maxMinute = 59;
    if (disableFuture && dateDraft === todayKey && parseInt(hourDraft, 10) === new Date().getHours()) {
      maxMinute = new Date().getMinutes();
    }
    return Array.from({ length: maxMinute + 1 }, (_, i) => String(i).padStart(2, "0"));
  }, [disableFuture, dateDraft, hourDraft]);

  // Clamp hours and minutes if out of bounds after changing date
  useEffect(() => {
    if (disableFuture && dateDraft === todayKey) {
      const nowH = new Date().getHours();
      const nowM = new Date().getMinutes();
      let newH = parseInt(hourDraft, 10);
      let newM = parseInt(minuteDraft, 10);
      let changed = false;

      if (newH > nowH) {
        newH = nowH;
        newM = nowM;
        changed = true;
      } else if (newH === nowH && newM > nowM) {
        newM = nowM;
        changed = true;
      }

      if (changed) {
        setHourDraft(String(newH).padStart(2, "0"));
        setMinuteDraft(String(newM).padStart(2, "0"));
      }
    }
  }, [disableFuture, dateDraft, hourDraft, minuteDraft]);

  useEffect(() => {
    if (visible) {
      const d = initialDate || todayKey;
      setDateDraft(d);
      const parsed = parseDateKey(d) || new Date();
      setDateMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
      setViewMode("calendar");
      setHourDraft(initialHour);
      setMinuteDraft(initialMinute);
    }
  }, [visible, initialDate, initialHour, initialMinute]);

  const calendarDays = useMemo(() => buildCalendarDays(dateMonth), [dateMonth]);

  function applyDate() {
    if (withTime) {
      onSelect(dateDraft, hourDraft, minuteDraft);
    } else {
      onSelect(dateDraft);
    }
    onClose();
  }

  function formatTimeLabel(h: string, m: string) {
    const hh = parseInt(h, 10);
    const ampm = hh >= 12 ? "PM" : "AM";
    const h12 = hh % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  }

  const renderMonths = () => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return (
      <View style={styles.grid}>
        {months.map((m, i) => (
          <Pressable key={m} style={styles.gridCell} onPress={() => {
            setDateMonth(new Date(dateMonth.getFullYear(), i, 1));
            setViewMode("calendar");
          }}>
            <Text style={[styles.gridCellText, dateMonth.getMonth() === i ? styles.gridCellTextSelected : null]}>{m}</Text>
          </Pressable>
        ))}
      </View>
    );
  };

  const renderYears = () => {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 150 }, (_, i) => currentYear - 100 + i).reverse();
    return (
      <ScrollView style={{ maxHeight: 300 }} indicatorStyle="white">
        <View style={styles.grid}>
          {years.map(y => (
            <Pressable key={y} style={styles.gridCell} onPress={() => {
              setDateMonth(new Date(y, dateMonth.getMonth(), 1));
              setViewMode("calendar");
            }}>
              <Text style={[styles.gridCellText, dateMonth.getFullYear() === y ? styles.gridCellTextSelected : null]}>{y}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Select Date</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color="#c4c7c8" />
            </Pressable>
          </View>
          <View style={styles.content}>
            <View style={styles.summaryCard}>
              <View>
                <Text style={styles.summaryLabel}>SELECTED DATE</Text>
                <Text style={styles.summaryValue}>{fullDateLabel(dateDraft)}</Text>
              </View>
              {withTime ? (
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.summaryLabel}>TIME</Text>
                  <Text style={styles.summaryValue}>{formatTimeLabel(hourDraft, minuteDraft)}</Text>
                </View>
              ) : (
                <MaterialIcons name="event" size={24} color="#7dffa2" />
              )}
            </View>

            <View style={styles.calendarHeader}>
              <Pressable onPress={() => setDateMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>
                <MaterialIcons name="chevron-left" size={26} color="#c4c7c8" />
              </Pressable>
              
              <View style={styles.navCenter}>
                <Pressable onPress={() => setViewMode(viewMode === "month" ? "calendar" : "month")}>
                  <Text style={styles.navCenterText}>{monthTitle(dateMonth)}</Text>
                </Pressable>
                <Pressable onPress={() => setViewMode(viewMode === "year" ? "calendar" : "year")}>
                  <Text style={styles.navCenterText}>{dateMonth.getFullYear()}</Text>
                </Pressable>
              </View>

              <Pressable onPress={() => setDateMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>
                <MaterialIcons name="chevron-right" size={26} color="#c4c7c8" />
              </Pressable>
            </View>

            {viewMode === "calendar" && (
              <>
                <View style={styles.weekdayGrid}>
                  {["SU", "MO", "TU", "WE", "TH", "FR", "SA"].map((day) => <Text key={day} style={styles.weekdayText}>{day}</Text>)}
                </View>
                <View style={styles.dateGrid}>
                  {calendarDays.map((day) => {
                    const selected = day.key === dateDraft;
                    let disabled = false;
                    if (disablePast && compareDateKeys(day.key, todayKey) < 0) disabled = true;
                    if (disableFuture && compareDateKeys(day.key, todayKey) > 0) disabled = true;
                    return (
                      <Pressable key={day.key} disabled={disabled} onPress={() => setDateDraft(day.key)} style={[styles.dateCell, selected ? styles.dateCellSelected : null, disabled ? styles.dateCellDisabled : null]}>
                        <Text style={[styles.dateCellText, !day.inMonth || disabled ? styles.dateTextMuted : null, selected ? styles.dateCellTextSelected : null]}>{day.day}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {withTime && (
                  <View style={styles.timePickerShell}>
                    <View style={styles.timePickerHeader}>
                      <Text style={styles.timePickerLabel}>Hour</Text>
                      <Text style={styles.timePickerLabel}>Minute</Text>
                    </View>
                    <View style={styles.timePickerBox}>
                      <View style={styles.timeHighlight} />
                      <TimeColumn label="Hour" values={hourOptions} value={hourDraft} onChange={setHourDraft} />
                      <Text style={styles.timeColon}>:</Text>
                      <TimeColumn label="Minute" values={minuteOptions} value={minuteDraft} onChange={setMinuteDraft} />
                    </View>
                  </View>
                )}
              </>
            )}

            {viewMode === "month" && renderMonths()}
            {viewMode === "year" && renderYears()}
            
          </View>
          <View style={styles.footer}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>CANCEL</Text>
            </Pressable>
            <Pressable style={styles.primaryButton} onPress={applyDate}>
              <Text style={styles.primaryText}>SET DATE</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const fs = (size: number) => Math.round(size * 0.9 * 10) / 10;

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(10,10,10,0.84)", padding: 12, justifyContent: "center" },
  card: { borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "#131313", overflow: "hidden" },
  header: { minHeight: 60, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(20), lineHeight: 28, fontWeight: "600" },
  closeButton: { padding: 4 },
  content: { padding: 16, gap: 14 },
  summaryCard: { borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "#101010", padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  summaryLabel: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(11), lineHeight: 16, letterSpacing: 1 },
  summaryValue: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(18), lineHeight: 24, fontWeight: "600" },
  calendarHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navCenter: { flexDirection: "row", gap: 16 },
  navCenterText: { color: "#ffffff", fontFamily: "Inter", fontSize: fs(16), lineHeight: 24, fontWeight: "700" },
  weekdayGrid: { flexDirection: "row" },
  weekdayText: { width: "14.2857%", textAlign: "center", color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(10), lineHeight: 16 },
  dateGrid: { flexDirection: "row", flexWrap: "wrap" },
  dateCell: { width: "14.2857%", height: 36, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  dateCellSelected: { backgroundColor: "#ffffff" },
  dateCellDisabled: { opacity: 0.36 },
  dateCellText: { color: "#e5e2e1", fontFamily: "Inter", fontSize: fs(16), lineHeight: 24 },
  dateCellTextSelected: { color: "#131313", fontWeight: "700" },
  dateTextMuted: { color: "rgba(196,199,200,0.32)" },
  timePickerShell: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.10)", paddingTop: 14, marginTop: 2 },
  timePickerHeader: { width: 196, alignSelf: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8, marginBottom: 8 },
  timePickerLabel: { color: "#8e9192", fontFamily: "JetBrains Mono", fontSize: fs(11), lineHeight: 16, letterSpacing: 1.2, textTransform: "uppercase" },
  timePickerBox: { height: 132, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "#101010", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 18, overflow: "hidden" },
  timeHighlight: { position: "absolute", top: 44, height: 44, left: 0, right: 0, borderTopWidth: 1, borderTopColor: "rgba(5,231,119,0.3)", borderBottomWidth: 1, borderBottomColor: "rgba(5,231,119,0.3)", backgroundColor: "rgba(5,231,119,0.06)" },
  timeColon: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(28), lineHeight: 36, fontWeight: "700", marginTop: -2 },
  timeColumn: { height: 132, width: 64 },
  timeColumnContent: { paddingVertical: 44, alignItems: "center" },
  timeValueButton: { width: 64, alignItems: "center", justifyContent: "center" },
  timeValue: { fontFamily: "Hanken Grotesk", fontSize: fs(24), lineHeight: 32, textAlign: "center" },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)", flexDirection: "row", gap: 16, backgroundColor: "#131313" },
  cancelButton: { flex: 1, height: 50, borderRadius: 8, borderWidth: 1, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  cancelText: { color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(14), lineHeight: 20, letterSpacing: 1.6, textTransform: "uppercase" },
  primaryButton: { flex: 1, height: 50, borderRadius: 8, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#000000", fontFamily: "JetBrains Mono", fontSize: fs(14), lineHeight: 20, letterSpacing: 1.6, textTransform: "uppercase", fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingTop: 8 },
  gridCell: { width: "25%", height: 48, alignItems: "center", justifyContent: "center" },
  gridCellText: { color: "#e5e2e1", fontFamily: "Inter", fontSize: fs(16) },
  gridCellTextSelected: { color: "#7dffa2", fontWeight: "700" },
});

function TimeColumn({ label, values, value, onChange }: { label: string; values: string[]; value: string; onChange: (value: string) => void }) {
  const scrollRef = useRef<ScrollView>(null);
  const selectedIndex = Math.max(0, values.indexOf(value));
  const isInteracting = useRef(false);
  const activeIndexRef = useRef(selectedIndex);
  const itemHeight = 44;
  const [scrollY] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (isInteracting.current) return;
    activeIndexRef.current = selectedIndex;
    scrollY.setValue(selectedIndex * itemHeight);
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: selectedIndex * itemHeight, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [scrollY, selectedIndex]);

  const selectNearest = (offsetY: number, commit = true) => {
    const nextIndex = Math.max(0, Math.min(values.length - 1, Math.round(offsetY / itemHeight)));
    if (nextIndex !== activeIndexRef.current) {
      activeIndexRef.current = nextIndex;
      if (commit) {
        onChange(values[nextIndex]);
      }
    }
  };

  return (
    <Animated.ScrollView
      ref={scrollRef}
      accessibilityLabel={label}
      style={styles.timeColumn}
      contentContainerStyle={styles.timeColumnContent}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
      snapToInterval={itemHeight}
      decelerationRate="fast"
      onScrollBeginDrag={() => { isInteracting.current = true; }}
      onScroll={(event) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        scrollY.setValue(offsetY);
        selectNearest(offsetY, true);
      }}
      onMomentumScrollEnd={(event) => {
        selectNearest(event.nativeEvent.contentOffset.y);
        isInteracting.current = false;
      }}
      onScrollEndDrag={(event) => {
        selectNearest(event.nativeEvent.contentOffset.y);
        if (!event.nativeEvent.velocity || Math.abs(event.nativeEvent.velocity.y) < 0.1) {
          isInteracting.current = false;
        }
      }}
      scrollEventThrottle={16}
    >
      {values.map((item, index) => {
        const center = index * itemHeight;
        const inputRange = [center - itemHeight * 2, center - itemHeight, center, center + itemHeight, center + itemHeight * 2];
        const scale = scrollY.interpolate({ inputRange, outputRange: [0.82, 0.96, 1.32, 0.96, 0.82], extrapolate: "clamp" });
        const opacity = scrollY.interpolate({ inputRange, outputRange: [0.28, 0.62, 1, 0.62, 0.28], extrapolate: "clamp" });
        const color = scrollY.interpolate({ inputRange, outputRange: ["rgba(196,199,200,0.34)", "rgba(229,226,225,0.72)", "#ffffff", "rgba(229,226,225,0.72)", "rgba(196,199,200,0.34)"], extrapolate: "clamp" });

        return (
          <Pressable key={item} onPress={() => onChange(item)} style={[styles.timeValueButton, { height: itemHeight }]}>
            <Animated.Text style={[styles.timeValue, { color, opacity, transform: [{ scale }] }]}>{item}</Animated.Text>
          </Pressable>
        );
      })}
    </Animated.ScrollView>
  );
}
