/* Inline scripts the shell runs before first paint. Kept out of the
   "use client" motion modules so the server shell can read them as strings. */

export const MOTION_PAUSED_STORAGE_KEY = "rive-site-motion-paused";
export const MOTION_PAUSED_ATTR = "data-motion-paused";

/** `[data-reveal]` content is hidden only while GSAP is on its way; if it
 * has not arrived in 4s, the page shows everything statically. Also restores
 * a stored "Pause motion" choice so loops never start. */
export const SITE_BOOT_SCRIPT =
  "(function(){var d=document.documentElement;d.classList.add('site-motion');" +
  "setTimeout(function(){if(!d.classList.contains('site-motion-ready'))d.classList.remove('site-motion')},4000);" +
  `try{if(localStorage.getItem('${MOTION_PAUSED_STORAGE_KEY}')==='1')d.setAttribute('${MOTION_PAUSED_ATTR}','')}catch(e){}})();`;
