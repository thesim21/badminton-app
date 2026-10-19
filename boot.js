/* boot: (organizer page only) confirm the licence when it is switched on, load the organizer code, then start the app */
(async()=>{
  if(document.body.dataset.page==="index"){
    if(LIC.on&&!(await LIC.start()))return;
    if(!(await LIC.loadOrganizer()))return;
  }
  bootApp();
})();
