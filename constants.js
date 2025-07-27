export const CLIENT_ID = '753842432555-gop0b5be9p1h315hrdm89ag1injqgj1b.apps.googleusercontent.com';
//export const SCOPES = 'https://www.googleapis.com/auth/photoslibrary https://www.googleapis.com/auth/photoslibrary.readonly https://www.googleapis.com/auth/photoslibrary.appendonly https://www.googleapis.com/auth/photospicker.mediaitems.readonly https://www.googleapis.com/auth/photoslibrary.edit.appcreateddata';
// Google has changed the API: Sharing and shared albums
//
//What's changing: Shared albums and the associated API functions (share, unshare, get, join, leave, and list) will return a 403 PERMISSION_DENIED after March 31, 2025.
//
//What you can do:
//
//Direct users to the Google Photos app to manage sharing themselves. You can provide clear instructions or deep links within your app to guide them.
//Managing app-created albums: enrichments and album contents
//
//What's changing: The photoslibrary.edit.appcreateddata is being added to the following three methods for conceptual consistency:
//
//    albums.addEnrichment
//    albums.batchAddMediaItems
//    albums.batchRemoveMediaItems
//
//What you can do:
//
//    If your app already uses these methods, consider adopting the photoslibrary.edit.appcreateddata scope to simplify your authorization process.

export const SCOPES = 'https://www.googleapis.com/auth/photoslibrary.readonly.appcreateddata https://www.googleapis.com/auth/photoslibrary.appendonly https://www.googleapis.com/auth/photospicker.mediaitems.readonly https://www.googleapis.com/auth/photoslibrary.edit.appcreateddata';
