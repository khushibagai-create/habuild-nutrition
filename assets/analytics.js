// Habuild prototype analytics — Mixpanel taxonomy v1
// Project: User Research (3998338)
// One file per prototype: edit PROTOTYPE_NAME + PROTOTYPE_VERSION at the top of the host HTML.

(function(){
  var PROJECT_TOKEN = '81929a7952506e86cd230338890d3298';
  var ENABLED = !/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  var STORAGE_KEYS = { name:'user_name', phone:'user_phone', firstSeen:'user_first_seen' };

  var H = window.HabuildAnalytics = {
    ready:false,
    prototype_name:'unset',
    prototype_version:'unset',
    _lastScreen:null,
    _screensViewed:0,
    _sessionStart:Date.now(),
    _lastScreenAt:Date.now(),
    _scrollMarks:{},
    _queue:[]
  };

  // ---- Mixpanel SDK loader (only when enabled) ----
  function loadMixpanel(cb){
    if(!ENABLED){ cb && cb(); return; }
    if(window.mixpanel && window.mixpanel.__loaded){ cb && cb(); return; }
    // Minimal loader snippet (vendored)
    (function(f,b){if(!b.__SV){var e,g,i,h;window.mixpanel=b;b._i=[];b.init=function(e,f,c){function g(a,d){var b=d.split(".");2==b.length&&(a=a[b[0]],d=b[1]);a[d]=function(){a.push([d].concat(Array.prototype.slice.call(arguments,0)))}}var a=b;"undefined"!==typeof c?a=b[c]=[]:c="mixpanel";a.people=a.people||[];a.toString=function(a){var d="mixpanel";"mixpanel"!==c&&(d+="."+c);a||(d+=" (stub)");return d};a.people.toString=function(){return a.toString(1)+".people (stub)"};i="disable time_event track track_pageview track_links track_forms track_with_groups add_group set_group remove_group register register_once alias unregister identify name_tag set_config reset opt_in_tracking opt_out_tracking has_opted_in_tracking has_opted_out_tracking clear_opt_in_out_tracking start_batch_senders people.set people.set_once people.unset people.increment people.append people.union people.track_charge people.clear_charges people.delete_user people.remove".split(" ");for(h=0;h<i.length;h++)g(a,i[h]);var j="set set_once union unset remove delete".split(" ");a.get_group=function(){function b(c){d[c]=function(){call2_args=arguments;call2=[c].concat(Array.prototype.slice.call(call2_args,0));a.push([e,call2])}}for(var d={},e=["get_group"].concat(Array.prototype.slice.call(arguments,0)),c=0;c<j.length;c++)b(j[c]);return d};b._i.push([e,f,c])};b.__SV=1.2;e=f.createElement("script");e.type="text/javascript";e.async=!0;e.onload=function(){window.mixpanel.__loaded=true;cb&&cb();};e.src="https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js";g=f.getElementsByTagName("script")[0];g.parentNode.insertBefore(e,g)}})(document,window.mixpanel||[]);
    window.mixpanel.init(PROJECT_TOKEN, {
      debug:false,
      track_pageview:false,
      persistence:'localStorage',
      ignore_dnt:true,
      api_host:'https://api.mixpanel.com'
    });
  }

  function getUserName(){ try{return localStorage.getItem(STORAGE_KEYS.name)||''}catch(e){return ''} }
  function getUserPhone(){ try{return localStorage.getItem(STORAGE_KEYS.phone)||''}catch(e){return ''} }

  function deviceType(){
    var w = window.innerWidth || document.documentElement.clientWidth;
    return w < 768 ? 'mobile' : 'desktop';
  }

  function normalizePhone(raw){
    if(!raw) return '';
    var digits = String(raw).replace(/\D+/g,'');
    if(digits.length>10) digits = digits.slice(-10);
    return digits;
  }

  function registerSuperProps(){
    if(!ENABLED || !window.mixpanel) return;
    try{
      window.mixpanel.register({
        user_name: getUserName(),
        user_phone: getUserPhone(),
        prototype_name: H.prototype_name,
        prototype_version: H.prototype_version,
        device_type: deviceType(),
        referrer: document.referrer || 'direct',
        entry_screen: H._entryScreen || null
      });
    }catch(e){}
  }

  // ---- Init ----
  H.init = function(opts){
    H.prototype_name = (opts && opts.prototype_name) || 'unset';
    H.prototype_version = (opts && opts.prototype_version) || 'unset';
    loadMixpanel(function(){
      H.ready = true;
      // If user is already identified, set up the session immediately
      var phone = getUserPhone();
      if(ENABLED && phone){
        try{
          window.mixpanel.identify(phone);
          registerSuperProps();
        }catch(e){}
      }
      // Drain queue
      H._queue.splice(0).forEach(function(fn){ try{fn()}catch(e){} });
    });
    bindGlobals();
  };

  // ---- Identity ----
  // Called by the prototype after the user submits name + phone in onboarding.
  H.captureIdentity = function(name, phoneRaw){
    var phone = normalizePhone(phoneRaw);
    if(!phone || phone.length<8){ return false; }
    var firstSeen = '';
    try{
      firstSeen = localStorage.getItem(STORAGE_KEYS.firstSeen) || new Date().toISOString();
      localStorage.setItem(STORAGE_KEYS.name, name||'');
      localStorage.setItem(STORAGE_KEYS.phone, phone);
      localStorage.setItem(STORAGE_KEYS.firstSeen, firstSeen);
    }catch(e){}
    var doIdentify = function(){
      if(!ENABLED) return;
      try{
        window.mixpanel.identify(phone);
        window.mixpanel.people.set({ $name: name||'', $phone: phone, first_seen: firstSeen });
        registerSuperProps();
        window.mixpanel.track('Identity Captured', { name:name||'', phone:phone });
      }catch(e){}
    };
    if(H.ready){ doIdentify(); } else { H._queue.push(doIdentify); }
    return true;
  };

  // ---- Track ----
  H.track = function(event, props){
    if(!getUserPhone()){ return; } // short-circuit until identity is captured
    var payload = Object.assign({ ts_client: Date.now() }, props||{});
    if(!ENABLED){ console.log('[track-local]', event, payload); return; }
    var fire = function(){
      try{ window.mixpanel.track(event, payload); }catch(e){}
    };
    if(H.ready){ fire(); } else { H._queue.push(fire); }
  };

  // ---- Screen Viewed ----
  H.screen = function(screenName){
    if(!screenName || screenName === H._lastScreen) return;
    if(!H._entryScreen) H._entryScreen = screenName;
    var now = Date.now();
    var timeOnPrev = Math.round((now - H._lastScreenAt)/1000);
    H.track('Screen Viewed', {
      screen_name: screenName,
      screen_path: '#'+screenName,
      time_on_prev_screen_sec: H._lastScreen ? timeOnPrev : 0
    });
    H._lastScreen = screenName;
    H._lastScreenAt = now;
    H._screensViewed += 1;
    H._scrollMarks = {};
  };

  // ---- Delegated bindings: data-track + scroll depth + session ended ----
  function bindGlobals(){
    // Delegated click for [data-track]
    document.addEventListener('click', function(e){
      var el = e.target.closest('[data-track]');
      if(!el) return;
      var event = el.getAttribute('data-track');
      var props = {};
      Array.from(el.attributes).forEach(function(a){
        if(a.name.indexOf('data-track-prop-')===0){
          props[a.name.replace('data-track-prop-','')] = a.value;
        }
      });
      if(!props.screen_name) props.screen_name = H._lastScreen || '';
      H.track(event, props);
    }, true);

    // Input focus
    document.addEventListener('focusin', function(e){
      var el = e.target;
      if(!el || !el.matches) return;
      if(el.matches('input, textarea, select')){
        H.track('Input Focused', {
          input_name: el.id || el.name || el.placeholder || 'unnamed',
          screen_name: H._lastScreen || ''
        });
      }
    }, true);

    // Scroll depth — sample the active .screen on scroll
    var scrollTimer;
    document.addEventListener('scroll', function(){
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function(){
        var active = document.querySelector('.screen.active');
        if(!active) return;
        var st = active.scrollTop;
        var max = active.scrollHeight - active.clientHeight;
        if(max<=0) return;
        var pct = Math.min(100, Math.round((st/max)*100));
        [25,50,75,100].forEach(function(mark){
          if(pct>=mark && !H._scrollMarks[mark]){
            H._scrollMarks[mark] = true;
            H.track('Scroll Depth', { screen_name: H._lastScreen||'', depth_pct: mark });
          }
        });
      }, 120);
    }, true);

    // Session ended
    window.addEventListener('beforeunload', function(){
      H.track('Session Ended', {
        session_duration_sec: Math.round((Date.now()-H._sessionStart)/1000),
        screens_viewed: H._screensViewed,
        last_screen: H._lastScreen || ''
      });
    });
  }
})();
