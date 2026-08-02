/**
 * Strip internal channel suffixes from display names.
 * Products and categories may have suffixes like
 * " store", " web", " event", " vendor" that should not be shown to customers.
 */
export const cleanName = (name: string): string =>
  name.replace(/\s+(store|web|event|vendor)$/i, '').trim();

/**
 * Strip Visual Composer / WoodMart shortcodes from HTML description.
 * e.g. [vc_row][vc_column]...[/vc_column][/vc_row]
 */
export const cleanDescription = (html: string): string =>
  html.replace(/\[\/?vc_[^\]]*\]/g, '').replace(/\[\/?woodmart_[^\]]*\]/g, '').trim();
