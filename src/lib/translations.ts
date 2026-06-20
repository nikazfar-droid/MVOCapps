// MVOC Malaysia PWA - System Localization System
// Standarized exclusively to English ('en') 

export const translations = {
  en: {
    // Navigation & Tabs
    dashboard: "Dashboard",
    profile: "Profile",
    vehicle: "My Vehicle",
    card: "Member Card",
    events: "Official Events",
    convoy: "Convoys",
    gallery: "Media Gallery",
    announcements: "Announcements",
    chapters: "State Chapters",
    merchants: "Merchant Partners",
    admin: "Admin Console",
    settings: "Settings",
    logout: "Logout",
    back: "Back",
    home: "Home",

    // Dashboard Greetings & Subsections
    greeting_morning: "Good Morning",
    greeting_afternoon: "Good Afternoon",
    greeting_evening: "Good Evening",
    greeting_generic: "Welcome back",
    active_mvoc_id: "Active MVOC-ID Badge",
    verified_member: "VERIFIED MEMBER",
    pending_verification: "PENDING VERIFICATION",
    gold_tier: "GOLD TIER",
    standard_tier: "STANDARD TIER",
    quick_actions: "Quick Portal Actions",
    upcoming_schedule: "Upcoming Schedule",
    active_announcement: "Active Bulletin Alerts",

    // My Vehicle
    vehicle_title: "My Toyota Veloz Command Center",
    vehicle_sub: "Manage your mechanical profiles and smart telemetry details",
    plate_number: "Plate Number",
    variant: "Variant",
    year_manuf: "Manufactured Year",
    color: "Body Paint Color",
    odometer: "Current Odometer Reading",
    next_service: "Next Service Milestones",
    service_status: "Service Status Check",
    healthy: "HEALTHY",
    due_soon: "DUE SOON",
    overdue: "OVERDUE",
    add_accessory: "Add Accessory Mod",
    service_logs: "Complete Lifecycle Logs",
    accessories_title: "Installed Accessories & Aesthetic Upgrades",

    // Member Card
    card_title: "Digital Club Membership ID",
    card_desc: "Your official verified NFC-pass for national conventions, merchant discounts, and convoys.",
    scan_qr: "Scan QR",
    save_pass: "Save Pass to Wallet",
    id_badge: "Official ID Badge",

    // Events
    events_title: "Official Gatherings & Cruises",
    upcoming: "Upcoming",
    ongoing: "Ongoing",
    completed: "Completed",
    register_event: "RSVP to Event",
    slots_left: "slots remaining",

    // Convoys
    convoy_title: "Active Convoy Dispatches",
    joining_form: "Convoy Registration details",
    vehicle_plate: "Vehicle Plate No.",
    shirt_size: "T-Shirt Size",
    pax_count: "Headcount (Pax)",
    agree_terms: "I agree to safe cruise & lane protocols",
    register_convoy: "Register Convoy",

    // Announcements
    announcements_title: "Official MVOC Bulletins",
    bulletin_alert: "Important Alert",
    pinned: "Pinned Notice",

    // Chapters
    chapters_title: "Toyota Veloz Regional Chapters",
    joined: "Joined",
    join_chapter: "Join Chapter",
    chapter_lead: "Chapter Lead",

    // Merchants
    merchant_title: "Verified Merchant Partners",
    merchant_desc: "Exclusive discounts and privileges for verified MVOC cardholders across Malaysia.",

    // Toast and Dialog Alerts
    language_saved: "Language preferences updated successfully.",
    success: "Success",
    info: "Info",
    warning: "Warning",
    error: "Error"
  }
};

export type LanguageCode = 'en';

export function getTranslation(key: keyof typeof translations.en, lang?: LanguageCode): string {
  return translations.en[key] || String(key);
}
