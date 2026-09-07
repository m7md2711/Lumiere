import type { Lang } from "./types";

export const dict = {
  en: {
    dir: "ltr",
    brand: "Lumiere Skin Clinic",
    // ---- patient form
    heroTitle: "Your experience matters",
    heroSub: "Share your feedback, suggestion, or anything on your mind. We read every message.",
    langLabel: "العربية",
    branch: "Branch",
    location: "Location",
    stepOf: (a: number, b: number) => `Step ${a} of ${b}`,
    step1: "Topic",
    step2: "Details",
    step3: "Contact",
    pickCategory: "What would you like to tell us about?",
    tellUsMore: "Tell us more",
    detailsHint: "Write a note, record a voice message, or both — either one is enough.",
    writeHere: "Write here…",
    orRecord: "Or record a voice note",
    record: "Record",
    stop: "Stop",
    rerecord: "Re-record",
    recording: "Recording…",
    maxSeconds: "Up to 60 seconds",
    micDenied: "We could not reach the microphone. You can still write your message above.",
    micUnsupported: "Voice recording is not supported on this browser. Please write your message above.",
    yourDetails: "How can we reach you?",
    name: "Your name",
    mobile: "Mobile number",
    mobileHint: "05X XXX XXXX",
    contactMethod: "Preferred way to reach you",
    call: "Call",
    whatsapp: "WhatsApp",
    preferredTime: "Best time to reach you",
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
    preferredLang: "Preferred language",
    english: "English",
    arabic: "Arabic",
    back: "Back",
    next: "Next",
    submit: "Send",
    sending: "Sending…",
    thankYouTitle: "Thank you for speaking with us",
    thankYouBody: "Your branch team has received this and will be in touch soon.",
    yourReference: "Your reference number",
    copy: "Copy",
    copied: "Copied",
    newSubmission: "Send another message",
    privacy: "Your submission is confidential and is used only to follow up with you.",
    // ---- validation / errors
    errCategory: "Please choose a topic.",
    errDetails: "Please write a note or record a voice message.",
    errName: "Please enter your name.",
    errMobile: "Please enter a valid UAE mobile number, for example 050 123 4567.",
    errSubmit: "We could not send your message. Please check your connection and try again.",
    retry: "Try again",
    badBranchTitle: "This code is not valid",
    badBranchBody: "The link or QR code seems out of date. Please ask our reception team for help.",
  },
  ar: {
    dir: "rtl",
    brand: "عيادة لوميير للجلدية",
    heroTitle: "تجربتكم تهمنا",
    heroSub: "شاركونا ملاحظاتكم أو اقتراحاتكم أو ما يشغلكم. نقرأ كل رسالة تصلنا.",
    langLabel: "English",
    branch: "الفرع",
    location: "الموقع",
    stepOf: (a: number, b: number) => `الخطوة ${a} من ${b}`,
    step1: "الموضوع",
    step2: "التفاصيل",
    step3: "التواصل",
    pickCategory: "بماذا تودون إخبارنا؟",
    tellUsMore: "أخبرونا المزيد",
    detailsHint: "اكتبوا ملاحظتكم أو سجلوا رسالة صوتية أو كليهما — أحدهما يكفي.",
    writeHere: "اكتبوا هنا…",
    orRecord: "أو سجلوا رسالة صوتية",
    record: "تسجيل",
    stop: "إيقاف",
    rerecord: "إعادة التسجيل",
    recording: "جاري التسجيل…",
    maxSeconds: "حتى 60 ثانية",
    micDenied: "تعذر الوصول إلى الميكروفون. يمكنكم كتابة رسالتكم في الأعلى.",
    micUnsupported: "التسجيل الصوتي غير مدعوم في هذا المتصفح. يرجى كتابة رسالتكم في الأعلى.",
    yourDetails: "كيف يمكننا التواصل معكم؟",
    name: "الاسم",
    mobile: "رقم الهاتف المتحرك",
    mobileHint: "05X XXX XXXX",
    contactMethod: "الطريقة المفضلة للتواصل",
    call: "اتصال",
    whatsapp: "واتساب",
    preferredTime: "الوقت المناسب للتواصل",
    morning: "صباحاً",
    afternoon: "بعد الظهر",
    evening: "مساءً",
    preferredLang: "اللغة المفضلة",
    english: "الإنجليزية",
    arabic: "العربية",
    back: "السابق",
    next: "التالي",
    submit: "إرسال",
    sending: "جاري الإرسال…",
    thankYouTitle: "شكراً لتواصلكم معنا",
    thankYouBody: "وصلت رسالتكم إلى فريق الفرع وسيتم التواصل معكم قريباً.",
    yourReference: "رقمكم المرجعي",
    copy: "نسخ",
    copied: "تم النسخ",
    newSubmission: "إرسال رسالة أخرى",
    privacy: "بياناتكم سرية وتُستخدم فقط لمتابعة ملاحظتكم معكم.",
    errCategory: "يرجى اختيار الموضوع.",
    errDetails: "يرجى كتابة ملاحظة أو تسجيل رسالة صوتية.",
    errName: "يرجى إدخال الاسم.",
    errMobile: "يرجى إدخال رقم إماراتي صحيح، مثال 0501234567.",
    errSubmit: "تعذر إرسال رسالتكم. يرجى التحقق من الاتصال والمحاولة مرة أخرى.",
    retry: "إعادة المحاولة",
    badBranchTitle: "هذا الرمز غير صالح",
    badBranchBody: "يبدو أن الرابط أو رمز الاستجابة السريعة غير محدث. يرجى طلب المساعدة من فريق الاستقبال.",
  },
} as const;

export type T = (typeof dict)["en"];

export function t(lang: Lang): T {
  return dict[lang] as unknown as T;
}

// ------------------------------------------------------------------ labels

export const categoryLabels: Record<string, { en: string; ar: string }> = {
  appointment: { en: "Appointment or waiting time", ar: "المواعيد أو وقت الانتظار" },
  staff: { en: "Communication or staff interaction", ar: "التواصل أو التعامل من فريق العمل" },
  treatment: { en: "Treatment or service experience", ar: "تجربة العلاج أو الخدمة" },
  medical: { en: "Medical concern after a service", ar: "ملاحظة طبية بعد الخدمة" },
  payment: { en: "Price, payment or package", ar: "السعر أو الدفع أو الباقة" },
  facility: { en: "Facility, comfort or privacy", ar: "المرافق أو الراحة أو الخصوصية" },
  suggestion: { en: "Suggestion for improvement", ar: "اقتراح للتحسين" },
  appreciation: { en: "Appreciation for a team member", ar: "كلمة تقدير لأحد أعضاء الفريق" },
  other: { en: "Other", ar: "موضوع آخر" },
};

export const categoryIcons: Record<string, string> = {
  appointment: "🗓️", staff: "💬", treatment: "✨", medical: "🩺",
  payment: "🧾", facility: "🏛️", suggestion: "💡", appreciation: "💐", other: "📝",
};

export function categoryLabel(c: string, lang: Lang): string {
  return categoryLabels[c]?.[lang] ?? c;
}

export const statusLabels: Record<string, { en: string; ar: string }> = {
  new: { en: "New", ar: "جديدة" },
  assigned: { en: "Assigned", ar: "محالة" },
  in_progress: { en: "In progress", ar: "قيد المعالجة" },
  escalated: { en: "Escalated", ar: "مصعّدة" },
  refund_approved: { en: "Refund approved", ar: "تمت الموافقة على الاسترداد" },
  resolved: { en: "Resolved", ar: "تم الحل" },
  closed: { en: "Closed", ar: "مغلقة" },
};

export const priorityLabels: Record<string, { en: string; ar: string }> = {
  low: { en: "Low", ar: "منخفضة" },
  normal: { en: "Normal", ar: "عادية" },
  high: { en: "High", ar: "مرتفعة" },
  urgent: { en: "Urgent", ar: "عاجلة" },
};

export function statusLabel(s: string, lang: Lang = "en"): string {
  return statusLabels[s]?.[lang] ?? s;
}
export function priorityLabel(p: string, lang: Lang = "en"): string {
  return priorityLabels[p]?.[lang] ?? p;
}

/** Admin-side strings. The admin UI is English-first with an Arabic toggle. */
export const adminDict = {
  en: {
    dir: "ltr", cases: "Cases", dashboard: "Dashboard", branches: "Branches", qr: "QR codes",
    signOut: "Sign out", signIn: "Sign in", username: "Username", password: "Password",
    badLogin: "Wrong username or password.",
  },
  ar: {
    dir: "rtl", cases: "الحالات", dashboard: "لوحة المعلومات", branches: "الفروع", qr: "رموز QR",
    signOut: "تسجيل الخروج", signIn: "تسجيل الدخول", username: "اسم المستخدم", password: "كلمة المرور",
    badLogin: "اسم المستخدم أو كلمة المرور غير صحيحة.",
  },
} as const;
