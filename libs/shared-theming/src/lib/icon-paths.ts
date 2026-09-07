import type { IconName } from '@trefaro/shared-models';

/**
 * The `viewBox` every glyph below is drawn in.
 *
 * Material Symbols are authored on a 960 unit grid with the baseline at the
 * origin, which is why the y-offset is negative. One value for all of them: a
 * per-glyph box would be a second thing to keep in step for no benefit.
 */
export const ICON_VIEW_BOX = '0 -960 960 960';

/**
 * The glyph data of every name this version offers (E49).
 *
 * Vendored, not fetched: NFR 9 rules out a third-party origin for the running
 * instance, and an icon font would be a second font machinery. Provenance and
 * licence are in `assets/icons/README.md` next to the font licences.
 *
 * Typed as a complete record over {@link IconName}, which is what makes the two
 * halves of the catalogue impossible to get out of step — a name without a
 * glyph and a glyph without a name are both compile errors. That is the reason
 * the names live in `@trefaro/shared-models` and the data lives here: only the
 * side that pulls in the paths pays for them, and the side a descriptor
 * validates against carries no kilobytes.
 */
export const ICON_PATHS: Readonly<Record<IconName, string>> = {
  event:
    'M528-248.18q-28-28.19-28-69Q500-358 528.18-386q28.19-28 69-28Q638-414 666-385.82q28 28.19 28 69Q694-276 665.82-248q-28.19 28-69 28Q556-220 528-248.18ZM180-80q-24 0-42-18t-18-42v-620q0-24 18-42t42-18h65v-60h65v60h340v-60h65v60h65q24 0 42 18t18 42v620q0 24-18 42t-42 18H180Zm0-60h600v-430H180v430Zm0-490h600v-130H180v130Zm0 0v-130 130Z',
  event_note:
    'M180-80q-24 0-42-18t-18-42v-620q0-24 18-42t42-18h65v-60h65v60h340v-60h65v60h65q24 0 42 18t18 42v620q0 24-18 42t-42 18H180Zm0-60h600v-430H180v430Zm0-490h600v-130H180v130Zm0 0v-130 130Zm100 210v-60h400v60H280Zm0 180v-60h279v60H280Z',
  forum:
    'M880-81 721-240H300q-24.75 0-42.37-17.63Q240-275.25 240-300v-80h440q24.75 0 42.38-17.63Q740-415.25 740-440v-280h80q24.75 0 42.38 17.62Q880-684.75 880-660v579ZM140-425l75-75h405v-320H140v395ZM80-280v-540q0-24.75 17.63-42.38Q115.25-880 140-880h480q24.75 0 42.38 17.62Q680-844.75 680-820v320q0 24.75-17.62 42.37Q644.75-440 620-440H240L80-280Zm60-220v-320 320Z',
  lightbulb:
    'M422.5-103.5Q399-127 399-161h162q0 34-23.5 57.5T480-80q-34 0-57.5-23.5ZM318-223v-60h324v60H318Zm5-121q-66-43-104.5-107.5T180-597q0-122 89-211t211-89q122 0 211 89t89 211q0 81-38 145.5T637-344H323Zm22-60h271q48-32 76-83t28-110q0-99-70.5-169.5T480-837q-99 0-169.5 70.5T240-597q0 59 28 110t77 83Zm135 0Z',
  link: 'M450-280H280q-83 0-141.5-58.5T80-480q0-83 58.5-141.5T280-680h170v60H280q-58.33 0-99.17 40.76-40.83 40.77-40.83 99Q140-422 180.83-381q40.84 41 99.17 41h170v60ZM325-450v-60h310v60H325Zm185 170v-60h170q58.33 0 99.17-40.76 40.83-40.77 40.83-99Q820-538 779.17-579q-40.84-41-99.17-41H510v-60h170q83 0 141.5 58.5T880-480q0 83-58.5 141.5T680-280H510Z',
  meeting_room:
    'M120-120v-60h92v-660h390v45h147v615h91v60H689v-615h-87v615H120Zm152-660v600-600Zm207.5 328.5Q491-463 491-480t-11.5-28.5Q468-520 451-520t-28.5 11.5Q411-497 411-480t11.5 28.5Q434-440 451-440t28.5-11.5ZM272-180h270v-600H272v600Z',
  qr_code_2:
    'M520-120v-80h80v80h-80Zm-80-80v-200h80v200h-80Zm320-120v-160h80v160h-80Zm-80-160v-80h80v80h-80Zm-480 80v-80h80v80h-80Zm-80-80v-80h80v80h-80Zm360-280v-80h80v80h-80ZM170-650h140v-140H170v140Zm-50 50v-240h240v240H120Zm50 430h140v-140H170v140Zm-50 50v-240h240v240H120Zm530-530h140v-140H650v140Zm-50 50v-240h240v240H600Zm80 480v-120h-80v-80h160v120h80v80H680ZM520-400v-80h160v80H520Zm-160 0v-80h-80v-80h240v80h-80v80h-80Zm40-200v-160h80v80h80v80H400Zm-190-90v-60h60v60h-60Zm0 480v-60h60v60h-60Zm480-480v-60h60v60h-60Z',
};

/**
 * The glyph behind a name, or `null` for a name this version does not draw.
 *
 * `null` rather than a placeholder glyph or a throw: the caller is usually a
 * plug-in descriptor, and a descriptor that names something unknown is a
 * mismatch to report in the module administration, not a reason for a tile to
 * disappear or a page to stop rendering.
 */
export function iconPath(name: string | null | undefined): string | null {
  if (!name) return null;
  return ICON_PATHS[name as IconName] ?? null;
}
