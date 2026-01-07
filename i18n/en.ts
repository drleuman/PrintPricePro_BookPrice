// i18n/en.ts
const en = {
  app_name: "PDF Book Price Calculator",
  upload_pdf_instructions: "Drag & drop your PDF here, or click to select",
  processing_pdf: "Processing PDF...",
  pdf_load_error_message: "Failed to load PDF. Please ensure it's a valid PDF file.",
  api_error_message: "Failed to fetch price offers. Please try again later.",
  select_pdf_first: "Please select a PDF file first.",
  enter_pages_or_upload_pdf: "Enter page counts manually or upload a PDF to get started.",
  enter_specs_or_upload_pdf: "Enter printing specifications manually or upload a PDF to calculate prices.",
  error_label: "Error",
  close_button: "Close",

  // Book Price Form
  book_price_calculator_title: "Book Printing Calculator",
  copies_label: "Copies",
  total_page_count_label: "Total Pages (from PDF or Manual)",
  interior_pages_label: "Interior Pages",
  cover_pages_label: "Cover Pages",
  book_size_label: "Book Size",
  orientation_label: "Orientation",
  interior_print_label: "Interior Print",
  cover_print_label: "Cover Print",
  paper_weight_interior_label: "Interior Paper Weight (gsm)",
  paper_weight_cover_label: "Cover Paper Weight (gsm)",
  binding_method_label: "Binding Method",
  finishing_options_label: "Finishing Options",
  delivery_country_label: "Delivery Country",
  calculate_price_button: "Calculate Price",
  recalculate_offers_button: "Recalculate Offers",
  calculating_offers: "Calculating offers...",
  endpapers_label: "Endpapers",
  endpapers_print_label: "Endpapers Print",
  paper_weight_endpapers_label: "Endpapers Paper Weight (gsm)",
  endpapers_mode_info: "Endpaper options for Hardcover binding.",

  // Print Offers Panel
  print_offers_title: "Print Offers",
  no_offers_available: "No offers available. Please adjust specifications and calculate.",
  best_offer_label: "Best Offer",
  estimated_delivery: "Estimated Delivery",
  breakdown_cost: "Breakdown Cost",
  choose_this_offer: "Choose This Offer",
  printing_cost: "Printing",
  paper_cost: "Paper",
  binding_cost: "Binding",
  finishing_cost: "Finishing",
  delivery_cost: "Delivery",
  other_cost: "Other",

  // Header
  about_app: "About",
  contact: "Contact",
};

export const t = (key: keyof typeof en, replacements?: { [key: string]: string | number }) => {
  let message = en[key] || key;
  if (replacements) {
    for (const placeholder in replacements) {
      if (Object.prototype.hasOwnProperty.call(replacements, placeholder)) {
        message = message.replace(new RegExp(`{{${placeholder}}}`, 'g'), String(replacements[placeholder]));
      }
    }
  }
  return message;
};