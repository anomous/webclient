/**
    @module rtcSession
*/
"use strict"

/**

    @class
        An RtcSession instance handles all jingle and webRTC operations
        for the Strophe connection object on which it was created, i.e. it
        adds webRTC support for that connection.
        To perform media calls, call its methods.
        To handle events generated by it, attach handlers to it.
        All events have the .rtc suffix, so they are namespaced under
        the <i>rtc</i> JQuery namespace, and can be manipulated in group
        by JQuery via this namespace. All events are called on the RtcSession
        instance and, since this object is not a DOM object, no bubbling will occur.
        Therefore, you should attach all event handlers to the RTC session instance.
        The handlers are called with the RtcSession instance as the <i>this</i> object.
    @param {Strophe.connection} stropheConn
        The Strophe connection object to add Jingle/webRTC support to
    @param {object} options
        Configuration options
    @param {object[]} [options.iceServers]
        An array of objects, each describing a TURN or STUN server, like so:
        [{url: 'stun:stun.l.google.com:19302'}]
        If none is specified, NAT won't be traversed.
    @returns {RtcSession}
*/

function RtcSession(stropheConn, options) {
    if (!RTC)
        throw new Error('This browser does not support webRTC');
    this.iceConfig = options.iceServers?options.iceServers:null;
    this.options = options;
    this.audioMuted = false;
    this.videoMuted = false;
    this.PRANSWER = false; // use either pranswer or autoaccept
    this.SEND_VIDEO = true;

    this.connection = stropheConn;
    this.jingle = stropheConn.jingle;
    stropheConn.jingle.rtcSession = this; //needed to access the RtcSession object from jingle event handlers
//muc stuff
    this.myroomjid = null;
    this.roomjid = null;
    this.list_members = [];
//===
    this.jingle.onConnectionEvent = this.onConnectionEvent;
    var self = this;
    if (RtcSession.RAWLOGGING)
    {
        this.connection.rawInput = function (data)
        { if (RtcSession.RAWLOGGING) console.log('RECV: ' + data); };
        this.connection.rawOutput = function (data)
        { if (RtcSession.RAWLOGGING) console.log('SEND: ' + data); };
    }

    if (options.iceServers)
        this.jingle.ice_config = {iceServers:options.iceServers};
    this.jingle.pc_constraints = RTC.pc_constraints;

    var j = this.jingle;

    j.eventHandler = this; //all callbacks will be called with this == eventHandler
    j.onIncomingCallRequest = this.onIncomingCallRequest;
  /**
    Fired when the incoming call request is not longer valid. This may happen for the reasons stated below,
    and the reason is specified in the info.event property: <br>
    1) Cancened by caller. info.event='canceled' <br>
    2) Handled by another resource (i.e. client). info.event='handled-elsewhere' <br>
    3) Call was not handled by anybody for a certain time, <br>
      even without the caller sending a cancel message. info.event='timeout'
    @event "call-canceled.rtc"
    @type {object}
    @property {string} from
        The full JID from which the call originated
    @property {object} info Additional details
    @property {string} info.event
        The reason why the call request is not valid anymore
    @property {boolean} [info.answered]
        Only if event='handled-elsewhere'. <i>true</i> if the call was answered by that other resource, of <i>false</i> if the call was declined by it
    @property {string} [info.by]
        Only if event='handled-elsewhere'. The full JID that handled the call
  */
    j.onCallCanceled = function(from, info) {$(self).trigger('call-canceled', [{from:from, info:info}]);};
    j.onCallAnswered = this.onCallAnswered;
    j.onCallTerminated = this.onCallTerminated;
    j.onRemoteStreamAdded = this.onRemoteStreamAdded;
    j.onRemoteStreamRemoved = this.onRemoteStreamRemoved;
    j.onNoStunCandidates = this.noStunCandidates;
    j.onJingleError = this.onJingleError;
    j.onMuted = function(sess, info) {
    /**
    Fired when the remote peer muted a stream
    @event "muted.rtc"
    @type {object}
    @property {object} info
        @property {boolean} [info.audio] Present and equals to <i>true</i> if audio was muted
        @property {boolean} [info.video] Present and equals to <i>true</i> if video was muted
    @property {SessWrapper} sess
        The session on which the event occurred
    */
        $(this).trigger('muted', [{info:info, sess: new SessWrapper(sess)}]);
    }
    j.onUnmuted = function(sess, info) {
    /**
    Fired when the remote peer unmuted a stream
    @event "unmuted.rtc"
    @type {object}
    @property {object} info
        @property {boolean} [info.audio] Present and equals to <i>true</i> if audio was muted
        @property {boolean} [info.video] Present and equals to <i>true</i> if video was muted
    @property {SessWrapper} sess
        The session on which the event occurred
    */

        $(this).trigger("unmuted", [{info:info, sess: new SessWrapper(sess)}]);
    }

    if (RTC.browser == 'firefox')
        this.jingle.media_constraints.mandatory.MozDontOfferDataChannel = true;
}
//global variables
//RtcSession.gLocalAudioOnlyStream = {stream: null, refcount:0};
//RtcSession.gLocalAudioVideoStream = {stream: null, refcount:0};

RtcSession.gLocalStream = null;
RtcSession.gLocalVid = null;
RtcSession.gVolMon = null;
RtcSession.gVolMonCallback = null;

RtcSession.prototype = {
  NO_DTLS: false, //compat with android
  _myGetUserMedia: function(options, successCallback, errCallback)
  {
    var self = this;
    if (RtcSession.gLocalStream)
    {
        var sessStream = RTC.cloneMediaStream(RtcSession.gLocalStream, options);
        self._refLocalStream();
        successCallback.call(self, sessStream);
        return;
    }

    RTC.getUserMediaWithConstraintsAndCallback({audio: true, video: true}, this,
      function(stream) {
        RtcSession.gLocalStream = stream;
        RtcSession.gLocalStreamRefcount = 0;
        var sessStream = RTC.cloneMediaStream(RtcSession.gLocalStream, options);
        self._refLocalStream();
        self._onMediaReady(RtcSession.gLocalStream);
        successCallback.call(self, sessStream);
      },
      function(error, e) {
        var msg = error?error.name:e;
        if (errCallback)
            errCallback(msg);
/**
      Fired when there was an error getting the media stream from the local camera/mic
      @event "local-media-fail.rtc"
      @type object
      @property {string} error
        The error message
*/
        $(self).trigger('local-media-fail', [{error:msg}]);
      });
 },

 onConnectionEvent: function(status, condition)
 {
//WARNING: called directly by Strophe, with this == connection.jingle
    switch (status)
    {
        case Strophe.Status.CONNFAIL:
        case Strophe.Status.DISCONNECTING:
        {
            this.terminateAll(null, null, true);
            this._freeLocalStreamIfUnused();
            break;
        }
        case Strophe.Status.CONNECTED:
        {
            this.connection.addHandler(RtcSession.prototype._onPresenceUnavailable.bind(this.rtcSession),
               null, 'presence', 'unavailable', null, null);
            this.getStunAndTurnCredentials();
            break;
        }
    }
 },

/**
    Initiates a media call to the specified peer
    @param {string} targetJid
        The JID of the callee. Can be a full jid (including resource),
        or a bare JID (without resource), in which case the call request will be broadcast
        using a special <message> packet. For more details on the call broadcast mechanism,
        see the Wiki
    @param {MediaOptions} options Call options
    @param {boolean} options.audio Send audio
    @param {boolean} options.video Send video
    @param {string} [myJid]
        Necessary only if doing MUC, because the user's JID in the
        room is different than her normal JID. If not specified,
        the user's 'normal' JID will be used
    @returns {{cancel: function()}}
        Returns an object with a cancel() method, that, when called, cancels the call request.
        This method returns <i>true</i> if the call was successfully canceled, and <i>false</i>
        in case the call was already answered by someone.
*/

 startMediaCall: function(targetJid, options, myJid)
 {
  var ansHandler;
  var declineHandler;
  var self = this;
  var isBroadcast = (!Strophe.getResourceFromJid(targetJid));

  self._myGetUserMedia({audio:true, video:true},
   function(sessStream) {
// Call accepted handler
        ansHandler = this.connection.addHandler(function(stanza) {
        if (!ansHandler)
            return;

        self.connection.deleteHandler(declineHandler);
        declineHandler = null;
        ansHandler = null;

        var fullPeerJid = $(stanza).attr('from');
        if (isBroadcast)
            self.connection.send($msg({to:Strophe.getBareJidFromJid(targetJid), type: 'megaNotifyCallHandled', by: fullPeerJid, accepted:'1'}));

        self.jingle.initiate(fullPeerJid, myJid ? myJid:self.connection.jid,
          sessStream, RtcSession.mediaOptionsToMutedState(options, sessStream));
        /**
            An outgoing call is being initiated by us
            @event "call-init.rtc"
            @type {object}
            @property {string} peer
                The full JID of the remote peer, to whom the call is being made
        */
            $(self).trigger('call-init', {peer:fullPeerJid});
      }, null, 'message', 'megaCallAnswer', null, targetJid, {matchBare: true});

//Call declined handler
    declineHandler = this.connection.addHandler(function(stanza) {
        if (!ansHandler)
            return;

        self.connection.deleteHandler(ansHandler);
        ansHandler = null;
        declineHandler = null;
        sessStream = null;
        self._freeLocalStreamIfUnused();

        var body = stanza.getElementsByTagName('body');
        var fullPeerJid = $(stanza).attr('from');

        if (isBroadcast)
            self.connection.send($msg({to:Strophe.getBareJidFromJid(targetJid), type: 'megaNotifyCallHandled', by: fullPeerJid, accepted:'0'}));
        /**
         A call that we have initiated has been declined by the remote peer
         @event "call-declined.rtc"
         @type {object}
         @property {string} from
            The full JID of the peer that declined the call
         @property {string} reason
            The short(one word) reason that the remote specified for declining the call.
            If the remote user didn't explicitly specify one, the default is 'busy'
         @property {string} [text]
            Optional verbose message specifying the reason
            why the remote declined the call. Can be an error message
        */
        $(self).trigger('call-declined', {
            peer: fullPeerJid,
            reason: $(stanza).attr('reason'),
            text : body.length ? RtcSession.xmlUnescape(body[0].textContent) : undefined
        });
    },
    null, 'message', 'megaCallDecline', null, targetJid, {matchBare: true});

    this.connection.send($msg({to:targetJid, type:'megaCall'}));

    setTimeout(function() {
        if (!ansHandler)
            return;

        self.connection.deleteHandler(ansHandler);
        ansHandler = null;
        self.connection.deleteHandler(declineHandler);
        declineHandler = null;
        sessStream = null;
        self._freeLocalStreamIfUnused();

        self.connection.send($msg({to:Strophe.getBareJidFromJid(targetJid), type: 'megaCallCancel'}));
       /**
        A call that we initiated was not answered (neither accepted nor rejected)
        within the acceptable timeout.
        @event "call-answer-timeout.rtc"
        @type {object}
        @property {string} peer The JID of the callee
       */
        $(self).trigger('call-answer-timeout', {peer: targetJid});
    }, self.jingle.callAnswerTimeout);
  }); //end myGetUserMedia()

  //return an object with a cancel() method
  return {cancel: function() {
        if (!ansHandler)
            return false;

        self.connection.deleteHandler(ansHandler);
        ansHandler = null;
        self.connection.deleteHandler(declineHandler);
        declineHandler = null;

        self._freeLocalStreamIfUnused();
        self.connection.send($msg({to:Strophe.getBareJidFromJid(targetJid), type: 'megaCallCancel'}));
        return true;
  }};
 },

 /**
    Terminates an ongoing call
    @param {string} [jid]
        The JID of the peer, serves to identify the call. If no jid is specified,
        all current calls are terminated
 */
 hangup: function(jid)
 {
    if (jid)
        this.jingle.terminateByJid(jid);
    else
        this.jingle.terminateAll();
 },

 /**
    Mutes/unmutes audio/video
    @param {boolean} state
        Specifies whether to mute or unmute:
        <i>true</i> mutes,  <i>false</i> unmutes.
    @param {object} what
        Determine whether the (un)mute operation applies to audio and/or video channels
        @param {boolean} [what.audio] The (un)mute operation is applied to the audio channel
        @param {boolean} [what.video] The (un)mute operation is applied to the video channel
    @param {string} [jid]
        If given, specifies that the mute operation will apply only
        to the call to the given JID. If not specified,
        the (un)mute will be applied to all ongoing calls.
 */
 muteUnmute: function(state, what, jid)
 {
    var sessions = this._getSessionsForJid(jid);
    if (!sessions)
        return false;
    for (var i=0; i<sessions.length; i++)
        sessions[i].muteUnmute(state, what);
    return true;
 },
 _getSessionsForJid: function(jid) {
    var sessions = [];
    if (!jid) {
        for (var k in this.jingle.sessions)
            sessions.push(this.jingle.sessions[k]);
        if (sessions.length < 1)
            return null;
    } else {
        jid = Strophe.getBareJidFromJid(jid);
        for(var j in this.jingle.jid2session)
            if (Strophe.getBareJidFromJid(j) == jid)
                sessions.push(this.jingle.jid2session[j]);
    }
    return sessions;
 },
 _onPresenceUnavailable: function(pres)
 {
    this.jingle.terminateByJid($(pres).attr('from'));
 },

 _onMediaReady: function(localStream) {
// localStream is actually RtcSession.gLocalStream

    for (var i = 0; i < localStream.getAudioTracks().length; i++)
        console.log('using audio device "' +localStream.getAudioTracks()[i].label + '"');

    for (i = 0; i < localStream.getVideoTracks().length; i++)
        console.log('using video device "' + localStream.getVideoTracks()[i].label + '"');

    // mute video on firefox and recent canary
    var elemClass = "localViewport";
    if (localStream.getVideoTracks().length < 1)
        elemClass +=" localNoVideo";

    if (RtcSession.gLocalVid)
        throw new Error("Local stream just obtained, but localVid was not null");

    var vid = $('<video class="'+elemClass+'" autoplay="autoplay" />');
    if (vid.length < 1)
        throw new Error("Failed to create local video element");
    vid = vid[0];
    vid.muted = true;
    vid.volume = 0;
    RtcSession.gLocalVid = vid;
    /**
        Local media stream has just been opened and a video element was
        created (the player param), but not yet added to the DOM. The stream object
        is a MediaStream interface object defined by the webRTC standard.
        This is the place to customize the player before it is shown. Also, this is the
        place to attach a mic volume callback, if used, via volMonAttachCallback().
        The callback will start being called just after the video element is shown.
        @event "local-stream-obtained.rtc"
        @type {object}
        @property {object} stream The local media stream object
        @property {DOM} player
        The video DOM element that displays the local video. <br>
        The video element will have the <i>localViewport</i> class.
        If the user does not have a camera, (only audio), the
        element will also have the localNoVideo CSS class.
        However, if the user has camera, event if he doesn't send video, local
        video will be displayed in the local player, and the local player will not have
        the <i>localNoVideo<i> class
    */
    $(this).trigger('local-stream-obtained', [{stream: localStream, player: vid}]);
    RtcSession._maybeCreateVolMon();
    RTC.attachMediaStream($(vid), localStream);
 },

 onIncomingCallRequest: function(from, reqStillValid, ansFunc)
 {
    var self = this;
    /**
    Incoming call request received
    @event "call-incoming-request.rtc"
    @type {object}
    @property {string} from
        The full JID of the caller
    @property {ReqValidFunc} reqStillValid
        A function returning boolean that can be used at any time to check if the call request is still
        valid (i.e. not timed out)
    @property {AnswerFunc} answer
        A function to answer or decline the call
    */
    $(this).trigger('call-incoming-request', [{peer: from, reqStillValid: reqStillValid, answer:
     function(accept, obj) {
        if (!reqStillValid()) //expired
            return false;

        if (!accept)
            return ansFunc(false, {reason: obj.reason?obj.reason:'busy', text: obj.text});

        self._myGetUserMedia({audio:true, video:true},
          function(sessStream) {
            ansFunc(true, {
                options:{
                    localStream: sessStream,
                    muted: RtcSession.mediaOptionsToMutedState(obj.mediaOptions, sessStream)
                }
            });
          },
          function(err) {
            ansFunc(false, {reason: 'error', text: "There was a problem accessing user's camera or microphone. Error: "+err});
          });

          return true;
    }}]);
    /**
    Function parameter to <i>call-incoming-request.rtc</i> to check if the call request is still valid
    @callback ReqValidFunc
    @returns {boolean}
    */

    /**
    Function parameter to <i>call-incoming-request.rtc</i> to answer or decline the call
    @callback AnswerFunc
    @param {boolean} accept Specifies whether to accept (<i>true</i>) or decline (<i>false</i>) the call
    @param {object} obj Options that depend on whether the call is to be acceped or declined
        @param {string} [obj.reason] If call declined: The one-word reason why the call was declined
            If not specified, defaults to 'busy'
        @param {string} [obj.text] If call declined: The verbose text explaining why the call was declined.
            Can be an error message
        @param {MediaOptions} [obj.mediaOptions] If call accepted: The same options that are used in startMediaCall()
    @returns {boolean}
        Returns <i>false</i> if the call request has expired, <i>true</i> otherwise
    */
 },

 onCallAnswered: function(info) {
 /**
    An incoming call has been answered
    @event "call-answered.rtc"
    @type {object}
    @property {string} peer The full JID of the remote peer that called us
 */
    $(this).trigger('call-answered', [info]);
 },

 removeVideo: function(sess) {
    /**
        The media session with peer JID has been destroyed, and the video element
            has to be removed from the DOM.
        @event "remote-player-remove.rtc"
        @type object
        @property {string} id The id of the html video element to be removed
        @property {SessWrapper} sess
    */
    $(this).trigger('remote-player-remove', [{id: '#remotevideo_'+sess.sid, sess:new SessWrapper(sess)}]);
 },

 onMediaRecv: function(playerElem, sess, stream) {
    if (!this.jingle.sessionIsValid(sess)) {
        this.error("onMediaRecv received for non-existing session:", sid)
        return;
    }
 /**
    Triggered when actual media packets start being received from <i>peer</i>,
    on session <i>sess</i>. The video DOM element has just been created, and is passed as the
    player property.
    @event "media-recv.rtc"
    @type {object}
    @property {string} peer The full JID of the peer
    @property {SessWrapper} sess The session
    @property {MediaStream} stream The remote media stream
    @property {DOM} player
    The video player element that has just been created for the remote stream.
    The element will always have the rmtViewport CSS class.
    If there is no video received, but only audio, the element will have
    also the rmtNoVideo CSS class.
    <br>NOTE: Because video is always negotiated if there is a camera, even if it is not sent,
    the rmt(No)Video is useful only when the peer does not have a camera at all,
    and is not possible to start sending video later during the call (for desktop
    sharing, the call has to be re-established)
 */
    $(this).trigger('media-recv', [{peer: sess.peerjid, sess:new SessWrapper(sess), stream: stream, player: playerElem}]);
//    sess.getStats(1000);
 },

 onCallTerminated: function(sess, reason, text) {
    if (sess.localStream)
        sess.localStream.stop();

    this.removeVideo(sess);
   /**
   Call was terminated, either by remote peer or by us
    @event "call-ended.rtc"
    @type {object}
    @property {string} peer The remote peer's full JID
    @property {SessWrapper} sess The session of the call
    @property {string} [reason] The reason for termination of the call
    @property {string} [text] The verbose reason or error message for termination of the call
   */
    $(this).trigger('call-ended', [{peer: sess.peerjid, sess: new SessWrapper(sess), reason:reason, text:text}]);
    this._freeLocalStreamIfUnused();
 },

 _freeLocalStreamIfUnused: function() {
    if (Object.keys(this.jingle.sessions).length > 0)
        return;
//last call ended
    this._unrefLocalStream();
 },

 waitForRemoteMedia: function(playerElem, sess) {
    if (!this.jingle.sessionIsValid(sess))
        return;
    var self = this;
    if (playerElem[0].currentTime > 0) {
        this.onMediaRecv(playerElem, sess, sess.remoteStream);
        RTC.attachMediaStream(playerElem, sess.remoteStream); // FIXME: why do i have to do this for FF?
       // console.log('waitForremotevideo', sess.peerconnection.iceConnectionState, sess.peerconnection.signalingState);
    }
    else
        setTimeout(function () { self.waitForRemoteMedia(playerElem, sess); }, 200);
 },
//onRemoteStreamAdded -> waitForRemoteMedia (waits till time>0) -> onMediaRecv() -> addVideo()
 onRemoteStreamAdded: function(sess, event) {
    if ($(document).find('#remotevideo_'+sess.sid).length !== 0) {
        console.warn('Ignoring duplicate onRemoteStreamAdded for session', sess.sid); // FF 20
        return;
    }
/**
    @event "remote-sdp-recv.rtc"
    @type {object}
    @property {string} peer The full JID of the peer
    @property {MediaStream} stream The remote media stream
    @property {SessWrapper} sess The call session
*/
    $(this).trigger('remote-sdp-recv', [{peer: sess.peerjid, stream: event.stream, sess: new SessWrapper(sess)}]);
    var elemClass;
    var videoTracks = event.stream.getVideoTracks();
    if (!videoTracks || (videoTracks.length < 1))
        elemClass = 'rmtViewport rmtNoVideo';
    else
        elemClass = 'rmtViewport rmtVideo';

    this._attachRemoteStreamHandlers(event.stream);
    // after remote stream has been added, wait for ice to become connected
    // old code for compat with FF22 beta
    var elem = $("<video autoplay='autoplay' class='"+elemClass+"' id='remotevideo_" + sess.sid+"' />");
    RTC.attachMediaStream(elem, event.stream);
    this.waitForRemoteMedia(elem, sess); //also attaches media stream once time > 0

//     does not yet work for remote streams -- https://code.google.com/p/webrtc/issues/detail?id=861
//    var options = { interval:500 };
//    var speechEvents = hark(data.stream, options);

//    speechEvents.on('volume_change', function (volume, treshold) {
//      console.log('volume for ' + sid, volume, treshold);
//    });
 },

 onRemoteStreamRemoved: function(event) {
 },

 noStunCandidates: function() {
    event.data.noStunCandidates = true;
 },


 onJingleError: function(sess, err, stanza, orig) {
    if (err.source == 'transportinfo')
        err.source = 'transport-info (i.e. webrtc ice candidate)';
    if (!orig)
        orig = "(unknown)";

    if (err.isTimeout) {
        console.error('Timeout getting response to "'+err.source+'" packet, session:'+sess.sid+', orig-packet:\n', orig);
 /**
    @event "jingle-timeout.rtc"
    @type {object}
    @property {string} src A semantic name of the operation where the timeout occurred
    @property {DOM} orig The original XML packet to which the response timed out
    @property {SessWrapper} sess The session on which the timeout occurred
  */
        $(this).trigger('jingle-timeout', [{src: err.source, orig: orig, sess: new SessWrapper(sess)}]);
    }
    else {
        if (!stanza)
            stanza = "(unknown)";
        console.error('Error response to "'+err.source+'" packet, session:', sess.sid,
            '\nerr-packet:\n', stanza, '\norig-packet:\n', orig);
 /**
    @event "jingle-error.rtc"
    @type {object}
    @property {string} src A semantic name of the operation where the error occurred
    @property {DOM} orig The XML stanza in response to which an error stanza was received
    @property {DOM} pkt The error XML stanza
    @property {SessWrapper} sess The session on which the error occurred
 */
        $(this).trigger('jingle-error', [{src:err.source, pkt: stanza, orig: orig, sess: new SessWrapper(sess)}]);
    }
 },

 /**
    Get info whether local audio and video are being sent at the moment in a call to the specified JID
    @param {string} fullJid The <b>full</b> JID of the peer to whom there is an ongoing call
    @returns {{audio: Boolean, video: Boolean}} If there is no call to the specified JID, null is returned
 */
 getSentMediaTypes: function(fullJid)
 {
    var sess = this.jingle.jid2session[fullJid];
    if (!sess)
        return null;
//we don't use sess.mutedState because in Forefox we don't have a separate
//local streams for each session, so (un)muting one session's local stream applies to all
//other sessions, making mutedState out of sync
    var audTracks = sess.localStream.getAudioTracks();
    var vidTracks = sess.localStream.getVideoTracks();
    return {
        audio: (audTracks.length > 0) && audTracks[0].enabled,
        video: (vidTracks.length > 0) && vidTracks[0].enabled
    }
 },

 /**
    Get info whether remote audio and video are being received at the moment in a call to the specified JID
    @param {string} fullJid The full peer JID to identify the call
    @returns {{audio: Boolean, video: Boolean}} If there is no call to the specified JID, null is returned
 */
 getReceivedMediaTypes: function(fullJid) {
    var sess = this.jingle.jid2session[fullJid];
    if (!sess)
        return null;
    var m = sess.remoteMutedState;
    return {
        audio: (sess.remoteStream.getAudioTracks().length > 0) && !m.audioMuted,
        video: (sess.remoteStream.getVideoTracks().length > 0) && !m.videoMuted
    }
 },

 /**
    This is a <b>class</b> method (i.e. not called on an instance but directly on RtcSession).
    Registers a callback function that will be called
    repeatedly every 400 ms with the current mic volume level from 0 to 100%, once
    the local media stream is accessible. This can be called multiple times to change
    the callback, but only one callback is registered at any moment,
    for performance reasons.
    @static
    @param {VolumeCb} cb
        The callback function

 */
 volMonAttachCallback: function(cb)
 {
    RtcSession.gVolMonCallback = cb;
 },

 /**
    The volume level callback function
    @callback VolumeCb
    @param {int} level - The volume level in percent, from 0 to 100
 */
 _attachRemoteStreamHandlers: function(stream)
 {
    var at = stream.getAudioTracks();
    for (var i=0; i<at.length; i++)
        at[i].onmute =
        function(e) {
            $(this).trigger('remote-audio-muted', [stream]);
        };
    var vt = stream.getVideoTracks();
    for (var i=0; i<vt.length; i++)
        vt[i].muted = function(e) {
            $(this).trigger('remote-video-muted', [stream]);
        };
 },
 _refLocalStream: function() {
    this._usedLocalStream = true;
    RtcSession.gLocalStreamRefcount++;
 },
 _unrefLocalStream: function() {
    if (!this._usedLocalStream)
        return;
    this._usedLocalStream = false;
    var cnt = --RtcSession.gLocalStreamRefcount;
    if (cnt > 0)
        return;

    if (!RtcSession.gLocalStream) {
        console.warn('RtcSession.unrefLocalStream: gLocalStream is null. refcount = ', cnt);
        return;
    }
/**
    Local stream is about to be closed and local video player to be destroyed
    @event local-video-destroy
    @type {object}
    @property {DOM} player The local video player, which is about to be destroyed
*/
    $(this).trigger('local-player-remove', [{player: RtcSession.gLocalVid}]);
    RtcSession.gLocalVid.pause();
    RtcSession.gLocalVid = null;
    RtcSession.gLocalStream.stop();
    RtcSession.gLocalStream = null;
 },
 /**
    Releases any global resources referenced by this instance, such as the reference
    to the local stream and video. This should be called especially if multiple instances
    of RtcSession are used in a single JS context
 */
 destroy: function() {
    this.hangup();
    this._unrefLocalStream();
 },
 _requiredLocalStream: function(channels) {
    if (channels.video)
        return RtcSession.gLocalAudioVideoStream;
      else
        return RtcSession.gLocalAudioOnlyStream;
  }
};

RtcSession._maybeCreateVolMon = function() {
    if (RtcSession.gVolMon)
        return true;
    if (!RtcSession.gVolMonCallback || (typeof hark !== "function"))
        return false;

    RtcSession.gVolMon = hark(RtcSession.gLocalStream, { interval: 400 });
    RtcSession.gVolMon.on('volume_change',
         function (volume, treshold)
         {
         //console.log('volume', volume, treshold);
            var level;
            if (volume > -35)
                level = 100;
             else if (volume > -60)
                level = (volume + 100) * 100 / 25 - 160;
            else
                level = 0;
            RtcSession.gVolMonCallback(level);
        });
    return true;
}

RtcSession.mediaOptionsToMutedState =  function(options, stream) {
    var mutedState = new MutedState;
    var muteAudio = (!options.audio && (stream.getAudioTracks().length > 0));
    var muteVideo = (!options.video && (stream.getVideoTracks().length > 0));
    mutedState.set(muteAudio, muteVideo);
    return mutedState;
}

RtcSession.xmlUnescape = function(text) {
    return text.replace(/\&amp;/g, '&')
               .replace(/\&lt;/g, '<')
               .replace(/\&gt;/g, '>')
               .replace(/\&apos;/g, "'")
               .replace(/\&quot;/g, '"');
}

/**
    Session object
    This is an internal object, but the following properties are useful for the library user.
    @constructor
*/
function SessWrapper(sess) {
    this._sess = sess;
}

SessWrapper.prototype = {

/**
    The remote peer's full JID
    @returns {string}
*/
peerJid: function(){
    return this._sess.peerjid;
},

/**
    Our own JID
    @returns {string}
*/
jid:function() {
return this._sess.jid;
},

/**
  The stream object of the stream received from the peer
    @returns {MediaStream}
*/
remoteStream: function() {
    return this._sess.remoteStream;
},

/**
    The Jingle session ID of this session
    @returns {string}
*/
sid: function() {
    return this._sess.sid;
}
};
