# Platform sizes

What each platform accepts, how it shows the image in feed, and which of our formats to upload.
Checked 28 Oct 2026. **Official** = the platform's own help or ads pages. **Third-party** = guides,
tool vendors, press; treat as indicative only. Re-check every six months; platforms change quietly.

## Decision table

| Platform and placement | Upload this format | Size | Why |
|---|---|---|---|
| Instagram feed post, carousel | `instagram_portrait` | 1080×1350 (4:5) | 4:5 is Meta's recommended feed ratio and the tallest the API accepts. 3:4 uploads work in the app only. |
| Instagram profile grid | (same post) | crops to 3:4 | The grid trims about 34px off each side of a 4:5 post. The `crop` lint check keeps text inside. |
| Instagram story, Reels/Shorts cover, WhatsApp status | `story` | 1080×1920 (9:16) | Safe zones: 270px top, 340px bottom, 65px sides. |
| Threads | `instagram_portrait` | 1080×1350 | Shows 4:5 in full; taller images are reported to crop to 4:5. |
| X, single image | `instagram_portrait` or `x_landscape` | 1080×1350 or 1600×900 | Single images from 3:4 to 2:1 display uncropped on mobile and web since 2021. Portrait takes more of a phone screen; landscape suits wide time series. |
| X, two to four images | avoid for charts | | Each image is cropped to a grid cell. Post one chart per post, or use a thread. |
| LinkedIn image post | `instagram_portrait` | 1080×1350 | Portrait fills the mobile feed. |
| LinkedIn link share (custom image) | `linkedin_landscape` | 1200×627 (1.91:1) | LinkedIn's stated size. Not cropped on mobile; other ratios get white padding. |
| LinkedIn document (carousel) post | `instagram_portrait` pages in one PDF | 1080×1350 | No page size is specified; every page shows at the first page's ratio. |
| YouTube community post | `square` | 1080×1080 (1:1) | YouTube suggests 1:1 "because that's how images are shown in the feed". |
| YouTube video frame, slides | `youtube` | 1920×1080 (16:9) | Video standard. |
| WhatsApp chat | `instagram_portrait` | 1080×1350 | Standard quality downscales to roughly 1600px on the long side; 1350 survives. Send as HD or as a document for print. |
| Substack or blog, inline square | `blog` | 1456×1456 | Substack's content column is about 728px; 1456 is 2x. |
| Substack inline wide, post social preview | `blog_wide` | 1456×1048 (14:10) | Substack's recommended social preview size; also a better inline shape for wide charts than a square. |
| Web page | `web` | 760×720 | SVG scales to any width via viewBox. |

We do not keep a separate `youtube_community` format any more: it was the same shape as `square`.

## Notes per platform

### Instagram
- Feed accepts 1.91:1 to 4:5. Meta's ads guide recommends 4:5 at 1440×1800 with a 1% ratio tolerance. **Official**:
  https://www.facebook.com/business/ads-guide/update/image/instagram-feed (fetched 28 Oct 2026).
  We stay at 1080 wide; Instagram displays at 1080 and higher uploads gain nothing for flat graphics.
- January 2025: profile grid changed from square to 3:4 thumbnails. May 2025: the app accepts 3:4 photos
  unaltered (Adam Mosseri on Threads). **Third-party** reports:
  https://www.indiatvnews.com/technology/news/instagram-finally-adds-native-3-4-aspect-ratio-for-photos-for-ios-and-android-2025-05-31-992687 ,
  https://www.kapwing.com/resources/instagrams-new-grid-layout-size-and-dimensions-2025/
- Scheduling tools that use the API still require 4:5 or wider (Buffer, **third-party**:
  https://support.buffer.com/hc/en-us/articles/360037965494-Instagram-s-accepted-aspect-ratio-ranges).
  So we keep 4:5 and protect the grid crop instead of moving to 3:4.
- Change since 2025: the grid crop. A 4:5 post loses (1080 − 1350×3/4)/2 ≈ 34px each side in the grid. Our side
  margin is 64px, so nothing important is lost; the `crop` lint check enforces it.

### Stories, Reels covers
- Meta recommends 9:16 and keeping about 14% of the top, 35% of the bottom and 6% of each side free of text
  and logos. **Official** (ads guide; the 35% bottom is for ads with a call-to-action button):
  https://www.facebook.com/business/ads-guide/update/image/instagram-story (fetched 28 Oct 2026).
- Organic stories have a reply bar, not a CTA; community measurements put it at 250–340px. **Third-party**.
- Our `story` format: top 270px (14%), bottom 340px, sides at least 65px (6%). For a story ad, raise bottom to 672px.
- Reels covers show in the profile grid cropped to the centre 3:4 (1080×1440), i.e. 240px off top and bottom. Our
  safe zones are larger than that crop, so a story-format chart also works as a Reels cover.

### Threads
- No official image spec found. **Third-party** guides agree 4:5 shows in full, and some report taller images are
  cropped to 4:5: https://www.outfy.com/blog/threads-image-and-video-size-guide/

### X
- May 2021: single images in standard ratios display in full on iOS and Android; November 2021 on the web. Images
  from 2:1 to 3:4 are not cropped. **Third-party** reports of X's announcement:
  https://www.socialsamosa.com/2021/05/twitter-uncropped-display-single-images-tweets ,
  https://engadget.com/twitter-full-size-image-previews-now-available-ios-android-201809678.html
- X's own help page (https://help.x.com/en/using-x/x-images) returned 403 to our fetcher; not verified directly.
- Multi-image posts crop each image into a grid cell; layouts are undocumented and change. Do not post charts that way.

### LinkedIn
- Custom images on link posts: "Use a 1.91:1 ratio (1200 x 627 pixels)… Images on mobile won't be cropped. Images
  of other ratios will appear in full size with subtle white padding." **Official**:
  https://www.linkedin.com/help/linkedin/answer/a563309 (fetched 28 Oct 2026).
- Image posts: maximum 36 megapixels; documents up to 100 MB and 300 pages; no aspect ratio stated. **Official**:
  https://www.linkedin.com/help/linkedin/answer/a564109 (fetched 28 Oct 2026).
- 4:5 portrait for image posts is the common **third-party** recommendation; desktop may crop the preview.

### YouTube community (Posts)
- "We suggest 1:1 ratio because that's how images are shown in the feed." Up to 10 images, 16 MB, JPG/PNG/GIF/WEBP;
  viewers can tap to expand. No pixel size given. **Official**:
  https://support.google.com/youtube/answer/7124474 (fetched 28 Oct 2026).
- Uploads between 2:5 and 5:2 are accepted, with occasional false "exceed aspect ratio limit" errors near the edges.
  **Third-party**: https://gadgetstouse.com/blog/2026/01/08/youtube-community-post-image-upload-in-wide-aspect-ratio/
- The owner believes the real size differs from 1080×1080. YouTube's own page says the feed shows 1:1, and no
  official source says otherwise. **Owner to confirm** with a screenshot of a live post if the feed shows another crop.

### WhatsApp
- No official spec. Standard quality downscales to about 1600px on the long side; HD keeps up to about 5120px; status
  updates are 9:16 and have no HD option. **Third-party** tests:
  https://www.idownloadblog.com/?p=963370 , https://help.superchat.com/en/articles/701423-whatsapp-media-sizes-formats

### Substack
- Substack's support article returned 403 to our fetcher. Its recommendation, as quoted by third parties: social
  preview images at least 1456×1048 (14:10), minimum 420×300; post body about 728px wide. **Third-party**:
  https://frequentlyaskedquestions.substack.com/p/substack-image-size-faq-the-definitive ,
  https://moda.app/resources/sizes/substack-social-preview
- Thumbnails crop differently in different places; keep the key message in the middle. Setting "Image cropping for
  post thumbnails" to Centered avoids skewed crops (**third-party** creator report).
