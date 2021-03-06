// libs
var React = require("react");
var ReactDOM = require("react-dom");
var utils = require('./../../ui/utils.jsx');
var RenderDebugger = require('./../../stores/mixins.js').RenderDebugger;
var MegaRenderMixin = require('./../../stores/mixins.js').MegaRenderMixin;
var ButtonsUI = require('./../../ui/buttons.jsx');
var ModalDialogsUI = require('./../../ui/modalDialogs.jsx');
var CloudBrowserModalDialog = require('./../../ui/cloudBrowserModalDialog.jsx');
var DropdownsUI = require('./../../ui/dropdowns.jsx');
var ContactsUI = require('./../ui/contacts.jsx');
var ConversationsUI = require('./../ui/conversations.jsx');
var TypingAreaUI = require('./../ui/typingArea.jsx');
var WhosTyping = require('./whosTyping.jsx').WhosTyping;
var getMessageString = require('./messages/utils.jsx').getMessageString;
var PerfectScrollbar = require('./../../ui/perfectScrollbar.jsx').PerfectScrollbar;
var Accordion = require('./../../ui/accordion.jsx').Accordion;
var AccordionPanel = require('./../../ui/accordion.jsx').AccordionPanel;
var ParticipantsList = require('./participantsList.jsx').ParticipantsList;

var GenericConversationMessage = require('./messages/generic.jsx').GenericConversationMessage;
var AlterParticipantsConversationMessage =
    require('./messages/alterParticipants.jsx').AlterParticipantsConversationMessage;
var TruncatedMessage = require('./messages/truncated.jsx').TruncatedMessage;
var PrivilegeChange = require('./messages/privilegeChange.jsx').PrivilegeChange;
var TopicChange = require('./messages/topicChange.jsx').TopicChange;
var SharedFilesAccordionPanel = require('./sharedFilesAccordionPanel.jsx').SharedFilesAccordionPanel;
var IncomingSharesAccordionPanel = require('./incomingSharesAccordionPanel.jsx').IncomingSharesAccordionPanel;

var ENABLE_GROUP_CALLING_FLAG = (
    typeof localStorage.enableGroupCalling !== 'undefined' &&
    localStorage.enableGroupCalling === "1"
);

var ConversationAudioVideoPanel = require('./conversationaudiovideopanel.jsx').ConversationAudioVideoPanel;

var JoinCallNotification = React.createClass({
    mixins: [MegaRenderMixin, RenderDebugger],
    render: function() {
        var room = this.props.chatRoom;
        if (Object.keys(room.callParticipants).length >= RtcModule.kMaxCallReceivers) {
            return <div className="in-call-notif yellow join">
                <i className="small-icon audio-call colorized"/>
                There is an active group call, but maximum call participants count had been reached.
            </div>;
        }
        else {
            return <div className="in-call-notif neutral join">
                <i className="small-icon audio-call colorized"/>
                There is an active group call. <a href="javascript:;" onClick={((e) => {
                room.joinCall();
                e.preventDefault();
                return false;
            })}>Join</a>
            </div>;
        }
    }
});

var ConversationRightArea = React.createClass({
    mixins: [MegaRenderMixin, RenderDebugger],
    getDefaultProps: function() {
        return {
            'requiresUpdateOnResize': true
        }
    },
    componentSpecificIsComponentEventuallyVisible: function() {
        return this.props.chatRoom.isCurrentlyActive;
    },
    allContactsInChat: function(participants) {
        var self = this;
        if (participants.length === 0) {
            return false;
        }

        var currentContacts = self.props.contacts;
        var foundNonMembers = 0;
        currentContacts.forEach(function(u, k) {
            if (u.c === 1) {
                if (participants.indexOf(k) === -1) {
                    foundNonMembers++;
                }
            }
        });

        if (foundNonMembers > 0) {
            return false;
        }
        else {
            return true;
        }
    },
    render: function() {
        var self = this;
        var room = this.props.chatRoom;

        if (!room || !room.roomId) {
            // destroyed
            return null;
        }
        var contactHandle;
        var contact;
        var contacts = room.getParticipantsExceptMe();
        if (contacts && contacts.length > 0) {
            contactHandle = contacts[0];
            contact = M.u[contactHandle];
        }
        else {
            contact = {};
        }



        // room is not active, don't waste DOM nodes, CPU and Memory (and save some avatar loading calls...)
        if (!room.isCurrentlyActive && !self._wasAppendedEvenOnce) {
            return null;
        }
        self._wasAppendedEvenOnce = true;

        var disabledCalls = (
            room.isReadOnly() ||
            !room.chatId ||
            (
                room.callManagerCall &&
                room.callManagerCall.state !== CallManagerCall.STATE.WAITING_RESPONSE_INCOMING
            )
        );


        var disableStartCalls = disabledCalls || megaChat.haveAnyIncomingOrOutgoingCall(room.chatIdBin) || (
            room.type === "group" && !ENABLE_GROUP_CALLING_FLAG
        );

        var startAudioCallButtonClass = "";
        var startVideoCallButtonClass = "";

        if (disabledCalls || disableStartCalls) {
            startAudioCallButtonClass = startVideoCallButtonClass = "disabled";
        }

        var startAudioCallButton =
            <div className={"link-button light" + " " + startVideoCallButtonClass} onClick={() => {
                if (!disableStartCalls) {
                    room.startAudioCall();
                }
            }}>
                <i className="small-icon colorized audio-call"></i>
                {__(l[5896])}
            </div>;

        var startVideoCallButton =
            <div className={"link-button light" + " " + startVideoCallButtonClass} onClick={() => {
                if (!disableStartCalls) {
                    room.startVideoCall();
                }
            }}>
                <i className="small-icon colorized video-call"></i>
                {__(l[5897])}
            </div>;
        var AVseperator = <div className="chat-button-seperator"></div>;
        var endCallButton =
                    <div className={"link-button light red"} onClick={() => {
                        if (room.callManagerCall) {
                            room.callManagerCall.endCall();
                        }
                    }}>
            <i className="small-icon colorized horizontal-red-handset"></i>
            {room.type === "group" ? "Leave call" : l[5884]}
        </div>;


        if (
            room.callManagerCall &&
            room.callManagerCall.isActive() === true
        ) {
            startAudioCallButton = startVideoCallButton = null;
        } else {
            endCallButton = null;
        }



        if (room.type === "group") {
            // if its a 1on1
            if (
                room.callParticipants &&
                Object.keys(room.callParticipants).length > 0 &&
                (
                    !room.callManagerCall ||
                    room.callManagerCall.isActive() === false
                )
            ) {
                // call is active, but I'm not in
                startAudioCallButton = startVideoCallButton = null;
            }
        }


        if (room.type === "group" && !ENABLE_GROUP_CALLING_FLAG) {
            startAudioCallButton = startVideoCallButton = null;
        }



        var isReadOnlyElement = null;

        if (room.isReadOnly()) {
            // isReadOnlyElement = <span className="center">(read only chat)</span>;
        }
        var excludedParticipants = room.type === "group" ?
            (
                room.members && Object.keys(room.members).length > 0 ? Object.keys(room.members) :
                    room.getParticipants()
            )   :
            room.getParticipants();

        if (excludedParticipants.indexOf(u_handle) >= 0) {
            array.remove(excludedParticipants, u_handle, false);
        }
        var dontShowTruncateButton = false;
        if (
            !room.iAmOperator() ||
            room.isReadOnly() ||
            room.messagesBuff.messages.length === 0 ||
            (
                room.messagesBuff.messages.length === 1 &&
                room.messagesBuff.messages.getItem(0).dialogType === "truncated"
            )
        ) {
            dontShowTruncateButton = true;
        }

        var membersHeader = null;

        // console.error(
        //     self.findDOMNode(),
        //     excludedParticipants,
        //         self.allContactsInChat(excludedParticipants),
        //         room.isReadOnly(),
        //         room.iAmOperator(),
        //     myPresence === 'offline'
        // );

        var renameButtonClass = "link-button light " + (
            room.isReadOnly() || !room.iAmOperator() ?
                "disabled" : ""
            );

        var participantsList = null;
        if (room.type === "group") {
            participantsList = <div>
                {isReadOnlyElement}
                <ParticipantsList
                    chatRoom={room}
                    members={room.members}
                    isCurrentlyActive={room.isCurrentlyActive}
                />
                <ButtonsUI.Button
                    className="link-button green light"
                    icon="rounded-plus colorized"
                    label={__(l[8007])}
                    contacts={this.props.contacts}
                    disabled={
                        /* Disable in case I don't have any more contacts to add ... */
                        !(
                            !self.allContactsInChat(excludedParticipants) &&
                            !room.isReadOnly() &&
                            room.iAmOperator()
                        )
                    }
                >
                    <DropdownsUI.DropdownContactsSelector
                        contacts={this.props.contacts}
                        megaChat={this.props.megaChat}
                        chatRoom={room}
                        exclude={
                            excludedParticipants
                        }
                        multiple={true}
                        className="popup add-participant-selector"
                        singleSelectedButtonLabel={__(l[8869])}
                        multipleSelectedButtonLabel={__(l[8869])}
                        nothingSelectedButtonLabel={__(l[8870])}
                        onSelectDone={this.props.onAddParticipantSelected}
                        positionMy="center top"
                        positionAt="left bottom"
                    />
                </ButtonsUI.Button>
            </div>;
        }

        return <div className="chat-right-area">
            <PerfectScrollbar
                className="chat-right-area conversation-details-scroll"
                options={{
                    'suppressScrollX': true
                }}
                ref={function(ref) {
                    self.rightScroll = ref;
                }}
                triggerGlobalResize={true}
                chatRoom={self.props.chatRoom}>
                <div className="chat-right-pad">
                    <Accordion
                        onToggle={function() {
                            // wait for animations.
                            setTimeout(function() {
                                if (self.rightScroll) {
                                    self.rightScroll.reinitialise();
                                }
                            }, 250);
                        }}
                        expandedPanel={room.type === "group" ? "participants" : "options"}>
                        {participantsList ? <AccordionPanel className="small-pad" title={l[8876]} key="participants">
                            {participantsList}
                        </AccordionPanel> : null}

                        <AccordionPanel className="have-animation buttons" title={l[7537]} key="options">
                            <div>
                            {startAudioCallButton}
                            {startVideoCallButton}
                            {AVseperator}
                            {
                                room.type == "group" ?
                                (
                                    <div className={renameButtonClass}
                                         onClick={(e) => {
                                             if ($(e.target).closest('.disabled').length > 0) {
                                                 return false;
                                             }
                                             if (self.props.onRenameClicked) {
                                                self.props.onRenameClicked();
                                             }
                                    }}>
                                        <i className="small-icon colorized writing-pen"></i>
                                        {__(l[9080])}
                                    </div>
                                ) : null
                            }

                            <ButtonsUI.Button
                                className="link-button light dropdown-element"
                                icon="rounded-grey-up-arrow colorized"
                                label={__(l[6834] + "...")}
                                disabled={room.isReadOnly()}
                                >
                                <DropdownsUI.Dropdown
                                    contacts={this.props.contacts}
                                    megaChat={this.props.megaChat}
                                    className="wide-dropdown send-files-selector light"
                                    noArrow="true"
                                    vertOffset={4}
                                    onClick={() => {}}
                                >
                                    <div className="dropdown info-txt">
                                        {__(l[19793]) ? __(l[19793]) : "Send files from..."}
                                    </div>
                                    <DropdownsUI.DropdownItem
                                        className="link-button light"
                                        icon="grey-cloud colorized"
                                        label={__(l[19794]) ? __(l[19794]) : "My Cloud Drive"}
                                        onClick={() => {
                                            self.props.onAttachFromCloudClicked();
                                        }} />
                                    <DropdownsUI.DropdownItem
                                        className="link-button light"
                                        icon="grey-computer colorized"
                                        label={__(l[19795]) ? __(l[19795]) : "My computer"}
                                        onClick={() => {
                                            self.props.onAttachFromComputerClicked();
                                        }} />
                                </DropdownsUI.Dropdown>
                            </ButtonsUI.Button>

                            {endCallButton}

                            {
                                <div className={"link-button light " + (dontShowTruncateButton ? "disabled" : "")}
                                     onClick={(e) => {
                                         if ($(e.target).closest('.disabled').length > 0) {
                                             return false;
                                         }
                                         if (self.props.onTruncateClicked) {
                                            self.props.onTruncateClicked();
                                         }
                                }}>
                                    <i className="small-icon colorized clear-arrow"></i>
                                    {__(l[8871])}
                                </div>
                            }
                            {<div className="chat-button-seperator"></div>}
                            {
                                <div className={"link-button light"}
                                     onClick={(e) => {
                                        if ($(e.target).closest('.disabled').length > 0) {
                                            return false;
                                        }
                                        if (room.isArchived()) {
                                            if (self.props.onUnarchiveClicked) {
                                               self.props.onUnarchiveClicked();
                                            }
                                        } else {
                                            if (self.props.onArchiveClicked) {
                                               self.props.onArchiveClicked();
                                            }
                                        }
                                }}>
                                    <i className={"small-icon colorized " +  ((room.isArchived()) ? "unarchive" :
                                        "archive")}></i>
                                    {room.isArchived() ? __(l[19065]) : __(l[16689])}
                                </div>
                            }
                            { room.type === "group" ? (
                                <div className={"link-button light red " + (
                                        room.stateIsLeftOrLeaving() ? "disabled" : ""
                                    )}
                                     onClick={(e) => {
                                         if ($(e.target).closest('.disabled').length > 0) {
                                             return false;
                                         }
                                         if (self.props.onLeaveClicked) {
                                            self.props.onLeaveClicked();
                                         }
                                }}>
                                    <i className="small-icon colorized rounded-stop"></i>
                                    {l[8633]}
                                </div>
                            ) : null
                            }
                            { room._closing !== true && room.type === "group" && room.stateIsLeftOrLeaving() ? (
                                <div className="link-button light red" onClick={() => {
                                    if (self.props.onCloseClicked) {
                                        self.props.onCloseClicked();
                                    }
                                }}>
                                    <i className="small-icon colorized rounded-stop"></i>
                                    {l[148]}
                                </div>
                            ) : null
                            }
                            </div>
                        </AccordionPanel>
                        <SharedFilesAccordionPanel key="sharedFiles" title={l[19796] ? l[19796] : "Shared Files"}
                                                   chatRoom={room}
                                                   sharedFiles={room.messagesBuff.sharedFiles} />
                        {room.type === "private" ?
                            <IncomingSharesAccordionPanel key="incomingShares" title={l[5542]} chatRoom={room} /> :
                            null
                        }
                    </Accordion>
                </div>
            </PerfectScrollbar>
        </div>;
    }
});



var ConversationPanel = React.createClass({
    mixins: [MegaRenderMixin, RenderDebugger],
    lastScrollPositionPerc: 1,
    componentSpecificIsComponentEventuallyVisible: function() {
        return this.props.chatRoom.isCurrentlyActive;
    },
    getInitialState: function() {
        return {
            startCallPopupIsActive: false,
            localVideoIsMinimized: false,
            isFullscreenModeEnabled: false,
            mouseOverDuringCall: false,
            attachCloudDialog: false,
            messagesToggledInCall: false,
            sendContactDialog: false,
            confirmDeleteDialog: false,
            pasteImageConfirmDialog: false,
            messageToBeDeleted: null,
            editing: false
        };
    },

    uploadFromComputer: function() {
        this.props.chatRoom.scrolledToBottom = true;

        this.props.chatRoom.uploadFromComputer();
    },
    refreshUI: function() {
        var self = this;
        var room = self.props.chatRoom;

        if (!self.props.chatRoom.isCurrentlyActive) {
            return;
        }

        room.renderContactTree();

        room.megaChat.refreshConversations();

        room.trigger('RefreshUI');
    },

    onMouseMove: SoonFc(function(e) {
        var self = this;
        var chatRoom = self.props.chatRoom;
        if (self.isMounted()) {
            chatRoom.trigger("onChatIsFocused");
        }
    }, 150),

    handleKeyDown: SoonFc(function(e) {
        var self = this;
        var chatRoom = self.props.chatRoom;
        if (self.isMounted() && chatRoom.isActive() && !chatRoom.isReadOnly()) {
            chatRoom.trigger("onChatIsFocused");
        }
    }, 150),
    componentDidMount: function() {
        var self = this;
        window.addEventListener('resize', self.handleWindowResize);
        window.addEventListener('keydown', self.handleKeyDown);

        self.props.chatRoom.rebind('call-ended.jspHistory call-declined.jspHistory', function (e, eventData) {
            self.callJustEnded = true;
        });

        self.props.chatRoom.rebind('onSendMessage.scrollToBottom', function (e, eventData) {
            self.props.chatRoom.scrolledToBottom = true;
            if (self.messagesListScrollable) {
                self.messagesListScrollable.scrollToBottom();
            }
        });
        self.props.chatRoom.rebind('openSendFilesDialog.cpanel', function(e) {
            self.setState({'attachCloudDialog': true});
        });

        self.eventuallyInit();
    },
    eventuallyInit: function(doResize) {
        var self = this;

        // because..JSP would hijack some DOM elements, we need to wait with this...
        if (self.initialised) {
            return;
        }
        var $container = $(self.findDOMNode());

        if ($container.length > 0) {
            self.initialised = true;
        }
        else {
            return;
        }

        $(self.findDOMNode()).rebind('resized.convpanel', function() {
            self.handleWindowResize();
        });

        self.$messages = $('.messages.scroll-area > .perfectScrollbarContainer', $container);


        var droppableConfig = {
            tolerance: 'pointer',
            drop: function(e, ui)
            {
                $.doDD(e,ui,'drop',1);
            },
            over: function (e, ui)
            {
                $.doDD(e,ui,'over',1);
            },
            out: function (e, ui)
            {
                $.doDD(e,ui,'out',1);
            }
        };

        self.$messages.droppable(droppableConfig);

        self.lastScrollPosition = null;
        self.props.chatRoom.scrolledToBottom = true;
        self.lastScrollHeight = 0;
        self.lastUpdatedScrollHeight = 0;

        var room = self.props.chatRoom;

        // collapse on ESC pressed (exited fullscreen)
        $(document)
            .rebind("fullscreenchange.megaChat_" + room.roomId, function() {
                if (!$(document).fullScreen() && room.isCurrentlyActive) {
                    self.setState({isFullscreenModeEnabled: false});
                }
                else if (!!$(document).fullScreen() && room.isCurrentlyActive) {
                    self.setState({isFullscreenModeEnabled: true});
                }
                self.forceUpdate();
            });

        if (doResize !== false) {
            self.handleWindowResize();
        }

        var ns = ".convPanel";
        $container
            .rebind('animationend' + ns +' webkitAnimationEnd' + ns + ' oAnimationEnd' + ns, function(e) {
                self.safeForceUpdate(true);
                $.tresizer();
            });
    },
    componentWillMount: function() {
        var self = this;
        var chatRoom = self.props.chatRoom;
        var megaChat = self.props.chatRoom.megaChat;

        $(chatRoom).rebind('onHistoryDecrypted.cp', function() {
            self.eventuallyUpdate();
        });
    },
    componentWillUnmount: function() {
        var self = this;
        var chatRoom = self.props.chatRoom;
        var megaChat = chatRoom.megaChat;

        window.removeEventListener('resize', self.handleWindowResize);
        window.removeEventListener('keydown', self.handleKeyDown);
        $(document).off("fullscreenchange.megaChat_" + chatRoom.roomId);
    },
    componentDidUpdate: function(prevProps, prevState) {
        var self = this;
        var room = this.props.chatRoom;

        self.eventuallyInit(false);

        room.megaChat.updateSectionUnreadCount();

        var $node = $(self.findDOMNode());

        if (self.loadingShown) {
            $('.js-messages-loading', $node).removeClass('hidden');
        }
        else {
            $('.js-messages-loading', $node).addClass('hidden');
        }
        self.handleWindowResize();

        if (prevState.messagesToggledInCall !== self.state.messagesToggledInCall || self.callJustEnded) {
            if (self.callJustEnded) {
                self.callJustEnded = false;
            }
            self.$messages.trigger('forceResize', [
                true,
                1
            ]);
            Soon(function() {
                self.messagesListScrollable.scrollToBottom(true);
            });
        }

        if (prevProps.isActive === false && self.props.isActive === true) {
            var $typeArea = $('.messages-textarea:visible:first', $node);
            if ($typeArea.length === 1) {
                $typeArea.trigger("focus");
                moveCursortoToEnd($typeArea[0]);
            }
        }
        if (!prevState.renameDialog && self.state.renameDialog === true) {
            var $input = $('.chat-rename-dialog input');
            $input.trigger("focus");
            $input[0].selectionStart = 0;
            $input[0].selectionEnd = $input.val().length;
        }

        if (prevState.editing === false && self.state.editing !== false) {
            if (self.messagesListScrollable) {
                self.messagesListScrollable.reinitialise(false);
                // wait for the reinit...
                Soon(function() {
                    if (self.editDomElement && self.editDomElement.length === 1) {
                        self.messagesListScrollable.scrollToElement(self.editDomElement[0], false);
                    }
                });
            }
        }

        if (self.isMounted() && self.$messages && self.isComponentEventuallyVisible()) {
            $(window).rebind('pastedimage.chatRoom', function (e, blob, fileName) {
                if (self.isMounted() && self.$messages && self.isComponentEventuallyVisible()) {
                    self.setState({'pasteImageConfirmDialog': [blob, fileName, URL.createObjectURL(blob)]});
                    e.preventDefault();
                }
            });
        }
    },
    handleWindowResize: function(e, scrollToBottom) {
        var $container = $(ReactDOM.findDOMNode(this));
        var self = this;

        self.eventuallyInit(false);

        if (!self.isMounted() || !self.$messages || !self.isComponentEventuallyVisible()) {
            return;
        }

        // Important. Please ensure we have correct height detection for Chat messages block.
        // We need to check ".fm-chat-input-scroll" instead of ".fm-chat-line-block" height
        var scrollBlockHeight = (
            $('.chat-content-block', $container).outerHeight() -
            ($('.chat-topic-block', $container).outerHeight() || 0) -
            ($('.call-block', $container).outerHeight() || 0) -
            $('.chat-textarea-block', $container).outerHeight()
        );

        if (scrollBlockHeight != self.$messages.outerHeight()) {
            self.$messages.css('height', scrollBlockHeight);
            $('.messages.main-pad', self.$messages).css('min-height', scrollBlockHeight);
            self.refreshUI(true);
            if (self.props.chatRoom.callManagerCall) {
                $('.messages-block', $container).height(
                    scrollBlockHeight + $('.chat-textarea-block', $container).outerHeight()
                );
            }
            else {
                $('.messages-block', $container).height('');
            }
        }
        else {
            self.refreshUI(scrollToBottom);
        }
    },
    isActive: function() {
        return document.hasFocus() && this.$messages && this.$messages.is(":visible");
    },
    onMessagesScrollReinitialise: function(
                            ps,
                            $elem,
                            forced,
                            scrollPositionYPerc,
                            scrollToElement
                ) {
        var self = this;
        var chatRoom = self.props.chatRoom;
        var mb = chatRoom.messagesBuff;

        // don't do anything if history is being retrieved at the moment.
        if (self.isRetrievingHistoryViaScrollPull || mb.isRetrievingHistory) {
            return;
        }

        if (forced) {
            if (!scrollPositionYPerc && !scrollToElement) {
                if (self.props.chatRoom.scrolledToBottom && !self.editDomElement) {
                    ps.scrollToBottom(true);
                    return true;
                }
            }
            else {
                // don't do anything if the UI was forced to scroll to a specific pos.
                return;
            }
        }

        if (self.isComponentEventuallyVisible()) {
            if (self.props.chatRoom.scrolledToBottom && !self.editDomElement) {
                ps.scrollToBottom(true);
                return true;
            }
            if (self.lastScrollPosition !== ps.getScrollPositionY() && !self.editDomElement) {
                ps.scrollToY(self.lastScrollPosition, true);
                return true;
            }

        }
    },
    onMessagesScrollUserScroll: function(
                        ps,
                        $elem,
                        e
    ) {
        var self = this;

        var scrollPositionY = ps.getScrollPositionY();
        var isAtTop = ps.isAtTop();
        var isAtBottom = ps.isAtBottom();
        var chatRoom = self.props.chatRoom;
        var mb = chatRoom.messagesBuff;

        if (mb.messages.length === 0) {
            self.props.chatRoom.scrolledToBottom = true;
            return;
        }

        // console.error(self.getUniqueId(), "is user scroll!");

        // turn on/off auto scroll to bottom.
        if (ps.isCloseToBottom(30) === true) {
            if (!self.props.chatRoom.scrolledToBottom) {
                mb.detachMessages();
            }
            self.props.chatRoom.scrolledToBottom = true;
        }
        else {
            self.props.chatRoom.scrolledToBottom = false;
        }

        if (isAtTop || (ps.getScrollPositionY() < 5 && ps.getScrollHeight() > 500)) {
            if (mb.haveMoreHistory() && !self.isRetrievingHistoryViaScrollPull && !mb.isRetrievingHistory) {
                ps.disable();



                self.isRetrievingHistoryViaScrollPull = true;
                self.lastScrollPosition = scrollPositionY;

                self.lastContentHeightBeforeHist = ps.getScrollHeight();
                // console.error('start:', self.lastContentHeightBeforeHist, self.lastScrolledToBottom);


                var msgsAppended = 0;
                $(chatRoom).rebind('onMessagesBuffAppend.pull', function() {
                    msgsAppended++;

                    // var prevPosY = (
                    //     ps.getScrollHeight() - self.lastContentHeightBeforeHist
                    // ) + self.lastScrollPosition;
                    //
                    //
                    // ps.scrollToY(
                    //     prevPosY,
                    //     true
                    // );
                    //
                    // self.lastContentHeightBeforeHist = ps.getScrollHeight();
                    // self.lastScrollPosition = prevPosY;
                });

                $(chatRoom).off('onHistoryDecrypted.pull');
                $(chatRoom).one('onHistoryDecrypted.pull', function(e) {
                    $(chatRoom).off('onMessagesBuffAppend.pull');
                    var prevPosY = (
                        ps.getScrollHeight() - self.lastContentHeightBeforeHist
                    ) + self.lastScrollPosition;

                    ps.scrollToY(
                        prevPosY,
                        true
                    );

                    // wait for all msgs to be rendered.
                    chatRoom.messagesBuff.addChangeListener(function() {
                        if (msgsAppended > 0) {
                            var prevPosY = (
                                ps.getScrollHeight() - self.lastContentHeightBeforeHist
                            ) + self.lastScrollPosition;

                            ps.scrollToY(
                                prevPosY,
                                true
                            );

                            self.lastScrollPosition = prevPosY;
                        }

                        delete self.lastContentHeightBeforeHist;

                        setTimeout(function() {
                            self.isRetrievingHistoryViaScrollPull = false;
                            // because of mousewheel animation, we would delay the re-enabling of the "pull to load
                            // history", so that it won't re-trigger another hist retrieval request

                            ps.enable();
                            self.forceUpdate();
                        }, 1150);

                        return 0xDEAD;
                    });



                });

                mb.retrieveChatHistory();
            }
        }

        if (self.lastScrollPosition !== ps.getScrollPositionY()) {
            self.lastScrollPosition = ps.getScrollPositionY();
        }


    },
    specificShouldComponentUpdate: function() {
        if (
            this.isRetrievingHistoryViaScrollPull ||
            this.loadingShown ||
            (this.props.chatRoom.messagesBuff.messagesHistoryIsLoading() && this.loadingShown) ||
            (
                this.props.chatRoom.messagesBuff.isDecrypting &&
                this.props.chatRoom.messagesBuff.isDecrypting.state() === 'pending' &&
                this.loadingShown
            ) ||
            (
                this.props.chatRoom.messagesBuff.isDecrypting &&
                this.props.chatRoom.messagesBuff.isDecrypting.state() === 'pending' &&
                this.loadingShown
            ) ||
            !this.props.chatRoom.isCurrentlyActive
        ) {
            return false;
        }
        else {
            return undefined;
        }
    },
    render: function() {
        var self = this;

        var room = this.props.chatRoom;
        if (!room || !room.roomId) {
            return null;
        }
        // room is not active, don't waste DOM nodes, CPU and Memory (and save some avatar loading calls...)
        if (!room.isCurrentlyActive && !self._wasAppendedEvenOnce) {
            return null;
        }
        self._wasAppendedEvenOnce = true;

        var contacts = room.getParticipantsExceptMe();
        var contactHandle;
        var contact;
        var avatarMeta;
        var contactName = "";
        if (contacts && contacts.length === 1) {
            contactHandle = contacts[0];
            contact = M.u[contactHandle];
            avatarMeta = contact ? generateAvatarMeta(contact.u) : {};
            contactName = avatarMeta.fullName;
        }
        else if (contacts && contacts.length > 1) {
            contactName = room.getRoomTitle(true);

        }

        var conversationPanelClasses = "conversation-panel " + room.type + "-chat";

        if (!room.isCurrentlyActive) {
            conversationPanelClasses += " hidden";
        }





        var messagesList = [
        ];

        if (
            (
                ChatdIntegration._loadingChats[room.roomId] &&
                ChatdIntegration._loadingChats[room.roomId].loadingPromise &&
                ChatdIntegration._loadingChats[room.roomId].loadingPromise.state() === 'pending'
            ) ||
            (self.isRetrievingHistoryViaScrollPull && !self.loadingShown) ||
            room.messagesBuff.messagesHistoryIsLoading() === true ||
            room.messagesBuff.joined === false ||
            (
                room.messagesBuff.joined === true &&
                room.messagesBuff.haveMessages === true &&
                room.messagesBuff.messagesHistoryIsLoading() === true
            ) ||
            (
                room.messagesBuff.isDecrypting &&
                room.messagesBuff.isDecrypting.state() === 'pending'
            )
        ) {
            self.loadingShown = true;
        }
        else if (
            room.messagesBuff.joined === true
        ) {
            if (!self.isRetrievingHistoryViaScrollPull && room.messagesBuff.haveMoreHistory() === false) {
                var headerText = (
                    room.messagesBuff.messages.length === 0 ?
                        __(l[8002]) :
                        __(l[8002])
                );

                headerText = headerText.replace("%s", "<span>" + htmlentities(contactName) + "</span>");

                messagesList.push(
                    <div className="messages notification" key="initialMsg">
                        <div className="header" dangerouslySetInnerHTML={{__html: headerText}}>
                        </div>
                        <div className="info">
                            {__(l[8080])}
                            <p>
                                <i className="semi-big-icon grey-lock"></i>
                                <span dangerouslySetInnerHTML={{
                                    __html: __(l[8540])
                                        .replace("[S]", "<strong>")
                                        .replace("[/S]", "</strong>")
                                }}></span>
                            </p>
                            <p>
                                <i className="semi-big-icon grey-tick"></i>
                                <span dangerouslySetInnerHTML={{
                                    __html: __(l[8539])
                                        .replace("[S]", "<strong>")
                                        .replace("[/S]", "</strong>")
                                }}></span>
                            </p>
                        </div>
                    </div>
                );
            }

            delete self.loadingShown;
        }
        else {
            delete self.loadingShown;
        }


        var lastTimeMarker;
        var lastMessageFrom = null;
        var lastGroupedMessageTimeStamp = null;
        var lastMessageState = null;
        var grouped = false;

        room.messagesBuff.messages.forEach(function(v, k) {
            if (!v.protocol && v.revoked !== true) {
                var shouldRender = true;
                if (
                    (
                        v.isManagement &&
                        v.isManagement() === true &&
                        v.isRenderableManagement() === false
                    ) ||
                    v.deleted === true
                ) {
                    shouldRender = false;
                }

                var timestamp = v.delay;
                var curTimeMarker;
                var iso = (new Date(timestamp * 1000).toISOString());
                if (todayOrYesterday(iso)) {
                    // if in last 2 days, use the time2lastSeparator
                    curTimeMarker = time2lastSeparator(iso);
                }
                else {
                    // if not in the last 2 days, use 1st June [Year]
                    curTimeMarker = acc_time2date(timestamp, true);
                }
                var currentState = v.getState ? v.getState() : null;

                if (shouldRender === true && curTimeMarker && lastTimeMarker !== curTimeMarker) {
                    lastTimeMarker = curTimeMarker;
                    messagesList.push(
                        <div className="message date-divider" key={v.messageId + "_marker"}
                        title={time2date(timestamp)}>{curTimeMarker}</div>
                    );

                    grouped = false;
                    lastMessageFrom = null;
                    lastGroupedMessageTimeStamp = null;
                    lastMessageState = false;
                }


                if (shouldRender === true) {
                    var userId = v.userId;
                    if (!userId) {
                        // dialogMessage have .authorContact instead of .userId
                        if (contact && contact.u) {
                            userId = contact.u;
                        }
                    }

                    if (
                        (v instanceof Message) &&
                        (v.keyid !== 0)
                    ) {

                        // the grouping logic for messages.
                        if (!lastMessageFrom || (userId && lastMessageFrom === userId)) {
                            if (timestamp - lastGroupedMessageTimeStamp < (5 * 60)) {
                                grouped = true;
                            }
                            else {
                                grouped = false;
                                lastMessageFrom = userId;
                                lastGroupedMessageTimeStamp = timestamp;
                                lastMessageState = currentState;
                            }
                        }
                        else {
                            grouped = false;
                            lastMessageFrom = userId;
                            if (lastMessageFrom === userId) {
                                lastGroupedMessageTimeStamp = timestamp;
                            }
                            else {
                                lastGroupedMessageTimeStamp = null;
                            }
                        }
                    }
                    else {
                        grouped = false;
                        lastMessageFrom = null;
                        lastGroupedMessageTimeStamp = null;
                    }
                }

                if (
                    (v.dialogType === "remoteCallEnded" || v.dialogType === "remoteCallStarted") &&
                    v &&
                    v.wrappedChatDialogMessage
                ) {
                    v = v.wrappedChatDialogMessage;
                }


                if (v.dialogType) {
                    var messageInstance = null;
                    if (v.dialogType === 'alterParticipants') {
                        messageInstance = <AlterParticipantsConversationMessage
                            message={v}
                            key={v.messageId}
                            contact={M.u[v.userId]}
                            grouped={grouped}
                        />
                    }
                    else if (v.dialogType === 'truncated') {
                        messageInstance = <TruncatedMessage
                            message={v}
                            key={v.messageId}
                            contact={M.u[v.userId]}
                            grouped={grouped}
                        />
                    }
                    else if (v.dialogType === 'privilegeChange') {
                        messageInstance = <PrivilegeChange
                            message={v}
                            key={v.messageId}
                            contact={M.u[v.userId]}
                            grouped={grouped}
                        />
                    }
                    else if (v.dialogType === 'topicChange') {
                        messageInstance = <TopicChange
                            message={v}
                            key={v.messageId}
                            contact={M.u[v.userId]}
                            grouped={grouped}
                        />
                    }

                    messagesList.push(messageInstance);
                }
                else {
                    if (!v.chatRoom) {
                        // ChatDialogMessages...
                        v.chatRoom = room;
                    }

                    messagesList.push(
                        <GenericConversationMessage
                            message={v}
                            state={v.state}
                            key={v.messageId}
                            contact={contact}
                            grouped={grouped}
                            onUpdate={() => {
                                self.onResizeDoUpdate();
                            }}
                            editing={self.state.editing === v.messageId || self.state.editing === v.pendingMessageId}
                            onEditStarted={($domElement) => {
                                self.editDomElement = $domElement;
                                self.props.chatRoom.scrolledToBottom = false;
                                self.setState({'editing': v.messageId});
                                self.forceUpdate();
                            }}
                            onEditDone={(messageContents) => {
                                self.props.chatRoom.scrolledToBottom = true;
                                self.editDomElement = null;

                                var currentContents = v.textContents;

                                v.edited = false;

                                if (messageContents === false || messageContents === currentContents) {
                                    self.messagesListScrollable.scrollToBottom(true);
                                    self.lastScrollPositionPerc = 1;
                                }
                                else if (messageContents) {
                                    $(room).trigger('onMessageUpdating', v);
                                    room.megaChat.plugins.chatdIntegration.updateMessage(
                                        room,
                                        v.internalId ? v.internalId : v.orderValue,
                                        messageContents
                                    );
                                    if (
                                        v.getState &&
                                        (
                                            v.getState() === Message.STATE.NOT_SENT ||
                                            v.getState() === Message.STATE.SENT
                                        ) &&
                                        !v.requiresManualRetry
                                    ) {
                                        if (v.textContents) {
                                            v.textContents = messageContents;
                                        }
                                        if (v.emoticonShortcutsProcessed) {
                                            v.emoticonShortcutsProcessed = false;
                                        }
                                        if (v.emoticonsProcessed) {
                                            v.emoticonsProcessed = false;
                                        }
                                        if (v.messageHtml) {
                                            delete v.messageHtml;
                                        }


                                        $(v).trigger(
                                            'onChange',
                                            [
                                                v,
                                                "textContents",
                                                "",
                                                messageContents
                                            ]
                                        );

                                        megaChat.plugins.richpreviewsFilter.processMessage({}, v, false, true);
                                    }

                                    self.messagesListScrollable.scrollToBottom(true);
                                    self.lastScrollPositionPerc = 1;
                                }
                                else if (messageContents.length === 0) {

                                    self.setState({
                                        'confirmDeleteDialog': true,
                                        'messageToBeDeleted': v
                                    });
                                }

                                self.setState({'editing': false});

                                Soon(function() {
                                    $('.chat-textarea-block:visible textarea').focus();
                                }, 300);
                            }}
                            onDeleteClicked={(e, msg) => {
                                self.setState({
                                    'editing': false,
                                    'confirmDeleteDialog': true,
                                    'messageToBeDeleted': msg
                                });
                                self.forceUpdate();
                            }}
                        />
                    );
                }
            }
        });

        var attachCloudDialog = null;
        if (self.state.attachCloudDialog === true) {
            var selected = [];
            attachCloudDialog = <CloudBrowserModalDialog.CloudBrowserDialog
                folderSelectNotAllowed={true}
                onClose={() => {
                    self.setState({'attachCloudDialog': false});
                    selected = [];
                }}
                onSelected={(nodes) => {
                    selected = nodes;
                }}
                onAttachClicked={() => {
                    self.setState({'attachCloudDialog': false});

                    self.props.chatRoom.scrolledToBottom = true;

                    room.attachNodes(
                        selected
                    );
                }}
            />
        }

        var sendContactDialog = null;
        if (self.state.sendContactDialog === true) {
            var excludedContacts = [];
            if (room.type == "private") {
                room.getParticipantsExceptMe().forEach(function(userHandle) {
                    var contact = M.u[userHandle];
                    if (contact) {
                        excludedContacts.push(
                            contact.u
                        );
                    }
                });
            }

            sendContactDialog = <ModalDialogsUI.SelectContactDialog
                megaChat={room.megaChat}
                chatRoom={room}
                exclude={excludedContacts}
                contacts={M.u}
                onClose={() => {
                    self.setState({'sendContactDialog': false});
                    selected = [];
                }}
                onSelectClicked={(selected) => {
                    self.setState({'sendContactDialog': false});

                    room.attachContacts(selected);
                }}
            />
        }

        var confirmDeleteDialog = null;
        if (self.state.confirmDeleteDialog === true) {
            confirmDeleteDialog = <ModalDialogsUI.ConfirmDialog
                megaChat={room.megaChat}
                chatRoom={room}
                title={__(l[8004])}
                name="delete-message"
                onClose={() => {
                    self.setState({'confirmDeleteDialog': false});
                }}
                onConfirmClicked={() => {
                    var msg = self.state.messageToBeDeleted;
                    if (!msg) {
                        return;
                    }
                    var chatdint = room.megaChat.plugins.chatdIntegration;
                    if (msg.getState() === Message.STATE.SENT ||
                        msg.getState() === Message.STATE.DELIVERED ||
                        msg.getState() === Message.STATE.NOT_SENT) {
                        chatdint.deleteMessage(room, msg.internalId ? msg.internalId : msg.orderValue);
                        msg.deleted = true;
                        msg.textContents = "";
                        room.messagesBuff.removeMessageById(msg.messageId);
                    }
                    else if (
                        msg.getState() === Message.STATE.NOT_SENT_EXPIRED
                    ) {
                        chatdint.discardMessage(room, msg.internalId ? msg.internalId : msg.orderValue);
                    }


                    self.setState({
                        'confirmDeleteDialog': false,
                        'messageToBeDeleted': false
                    });

                    if (
                        msg.getState &&
                        msg.getState() === Message.STATE.NOT_SENT &&
                        !msg.requiresManualRetry
                    ) {
                        msg.message = "";
                        msg.textContents = "";
                        msg.messageHtml = "";
                        msg.deleted = true;

                        $(msg).trigger(
                            'onChange',
                            [
                                msg,
                                "deleted",
                                false,
                                true
                            ]
                        );
                    }

                }}
            >
                <div className="fm-dialog-content">

                    <div className="dialog secondary-header">
                        {__(l[8879])}
                    </div>

                    <GenericConversationMessage
                        className="dialog-wrapper"
                        message={self.state.messageToBeDeleted}
                        hideActionButtons={true}
                        initTextScrolling={true}
                    />
                </div>
            </ModalDialogsUI.ConfirmDialog>
        }

        var pasteImageConfirmDialog = null;
        if (self.state.pasteImageConfirmDialog) {
            confirmDeleteDialog = <ModalDialogsUI.ConfirmDialog
                megaChat={room.megaChat}
                chatRoom={room}
                title={__("Confirm paste")}
                name="paste-image-chat"
                onClose={() => {
                    self.setState({'pasteImageConfirmDialog': false});
                }}
                onConfirmClicked={() => {
                    var meta = self.state.pasteImageConfirmDialog;
                    if (!meta) {
                        return;
                    }

                    try {
                        Object.defineProperty(meta[0], 'name', {
                            configurable: true,
                            writeable: true,
                            value: Date.now() + '.' + M.getSafeName(meta[1] || meta[0].name)
                        });
                    }
                    catch (e) {}

                    self.props.chatRoom.scrolledToBottom = true;

                    M.addUpload([meta[0]]);

                    self.setState({
                        'pasteImageConfirmDialog': false
                    });

                    URL.revokeObjectURL(meta[2]);
                }}
            >
                <div className="fm-dialog-content">

                    <div className="dialog secondary-header">
                        {__("Please confirm that you want to upload this image and share it in this chat room.")}
                    </div>

                    <img
                        src={self.state.pasteImageConfirmDialog[2]}
                        style={{
                            maxWidth: "90%",
                            height: "auto",
                            maxHeight: $(document).outerHeight() * 0.3,
                            margin: '10px auto',
                            display: 'block',
                            border: '1px solid #ccc',
                            borderRadius: '4px'
                        }}
                        onLoad={function(e) {
                            $(e.target).parents('.paste-image-chat').position({
                                of: $(document.body)
                            });
                        }}
                    />
                </div>
            </ModalDialogsUI.ConfirmDialog>
        }


        var confirmTruncateDialog = null;
        if (self.state.truncateDialog === true) {
            confirmDeleteDialog = <ModalDialogsUI.ConfirmDialog
                megaChat={room.megaChat}
                chatRoom={room}
                title={__(l[8871])}
                name="truncate-conversation"
                dontShowAgainCheckbox={false}
                onClose={() => {
                    self.setState({'truncateDialog': false});
                }}
                onConfirmClicked={() => {
                    self.props.chatRoom.scrolledToBottom = true;

                    room.truncate();

                    self.setState({
                        'truncateDialog': false
                    });
                }}
            >
                <div className="fm-dialog-content">

                    <div className="dialog secondary-header">
                        {__(l[8881])}
                    </div>
                </div>
            </ModalDialogsUI.ConfirmDialog>
        }
        if (self.state.archiveDialog === true) {
            confirmDeleteDialog = <ModalDialogsUI.ConfirmDialog
                megaChat={room.megaChat}
                chatRoom={room}
                title={__(l[19068])}
                name="archive-conversation"
                onClose={() => {
                    self.setState({'archiveDialog': false});
                }}
                onConfirmClicked={() => {
                    self.props.chatRoom.scrolledToBottom = true;

                    room.archive();

                    self.setState({
                        'archiveDialog': false
                    });
                }}
            >
                <div className="fm-dialog-content">

                    <div className="dialog secondary-header">
                        {__(l[19069])}
                    </div>
                </div>
            </ModalDialogsUI.ConfirmDialog>
        }
        if (self.state.unarchiveDialog === true) {
            confirmDeleteDialog = <ModalDialogsUI.ConfirmDialog
                megaChat={room.megaChat}
                chatRoom={room}
                title={__(l[19063])}
                name="unarchive-conversation"
                onClose={() => {
                    self.setState({'unarchiveDialog': false});
                }}
                onConfirmClicked={() => {
                    self.props.chatRoom.scrolledToBottom = true;

                    room.unarchive();

                    self.setState({
                        'unarchiveDialog': false
                    });
                }}
            >
                <div className="fm-dialog-content">

                    <div className="dialog secondary-header">
                        {__(l[19064])}
                    </div>
                </div>
            </ModalDialogsUI.ConfirmDialog>
        }
        if (self.state.renameDialog === true) {
            var onEditSubmit = function(e) {
                if ($.trim(self.state.renameDialogValue).length > 0 &&
                    self.state.renameDialogValue !== self.props.chatRoom.getRoomTitle()
                ) {
                    self.props.chatRoom.scrolledToBottom = true;

                    var participants = self.props.chatRoom.protocolHandler.getTrackedParticipants();
                    var promises = [];
                    promises.push(
                        ChatdIntegration._ensureKeysAreLoaded(undefined, participants)
                    );
                    var _runUpdateTopic = function() {
                        // self.state.value
                        var newTopic = self.state.renameDialogValue;
                        var topic = self.props.chatRoom.protocolHandler.embeddedEncryptTo
                                            (newTopic,
                                             strongvelope.MESSAGE_TYPES.TOPIC_CHANGE,
                                             participants);
                        if (topic) {
                            asyncApiReq({
                                "a":"mcst",
                                "id":self.props.chatRoom.chatId,
                                "ct":base64urlencode(topic),
                                "v": Chatd.VERSION
                            });
                        }
                    };
                    MegaPromise.allDone(promises).done(
                        function () {
                            _runUpdateTopic();
                        }
                    );
                    self.setState({'renameDialog': false, 'renameDialogValue': undefined});
                }
                e.preventDefault();
                e.stopPropagation();
            };

            confirmDeleteDialog = <ModalDialogsUI.ModalDialog
                megaChat={room.megaChat}
                chatRoom={room}
                title={__(l[9080])}
                name="rename-group"
                className="chat-rename-dialog"
                onClose={() => {
                    self.setState({'renameDialog': false, 'renameDialogValue': undefined});
                }}
                buttons={[
                    {
                        "label": l[61],
                        "key": "rename",
                        "className": (
                            $.trim(self.state.renameDialogValue).length === 0 ||
                            self.state.renameDialogValue === self.props.chatRoom.getRoomTitle() ?
                                "disabled" : ""
                        ),
                        "onClick": function(e) {
                            onEditSubmit(e);
                        }
                    },
                    {
                        "label": l[1686],
                        "key": "cancel",
                        "onClick": function(e) {
                            self.setState({'renameDialog': false, 'renameDialogValue': undefined});
                            e.preventDefault();
                            e.stopPropagation();
                        }
                    },
                ]}>
                <div className="fm-dialog-content">

                    <div className="dialog secondary-header">
                        <div className="rename-input-bl">
                            <input type="text" name="newTopic"
                                   defaultValue={self.props.chatRoom.getRoomTitle()}
                                   value={self.state.renameDialogValue}
                                   maxLength="30"
                                   onChange={(e) => {
                                self.setState({'renameDialogValue': e.target.value.substr(0, 30)});
                            }} onKeyUp={(e) => {
                                if (e.which === 13) {
                                    onEditSubmit(e);
                                }
                            }} />
                        </div>
                    </div>
                </div>
            </ModalDialogsUI.ModalDialog>
        }

        var additionalClass = "";
        if (
            additionalClass.length === 0 &&
            self.state.messagesToggledInCall &&
            room.callManagerCall &&
            room.callManagerCall.isActive()
        ) {
            additionalClass = " small-block";
        }

        var topicInfo = null;
        if (self.props.chatRoom.type === "group") {
            topicInfo = <div className="chat-topic-info">
                <div className="chat-topic-icon"></div>
                <div className="chat-topic-text">
                    <span className="txt">
                        <utils.EmojiFormattedContent>{
                            self.props.chatRoom.getRoomTitle()
                        }</utils.EmojiFormattedContent>
                    </span>
                    <span className="txt small">
                        {Object.keys(self.props.chatRoom.members).length}
                        Members
                    </span>
                </div>
            </div>;
        }
        else {
            var contacts = room.getParticipantsExceptMe();
            var contactHandle = contacts[0];
            var contact = M.u[contactHandle];

            topicInfo = <ContactsUI.ContactCard
                    className="short"
                    noContextButton="true"
                    contact={contact}
                    megaChat={self.props.chatRoom.megaChat}
                    showLastGreen={true}
                    key={contact.u}/>
        }

        var disabledCalls = (
            room.isReadOnly() ||
            !room.chatId ||
            (
                room.callManagerCall &&
                room.callManagerCall.state !== CallManagerCall.STATE.WAITING_RESPONSE_INCOMING
            )
        );


        var disableStartCalls = disabledCalls || megaChat.haveAnyIncomingOrOutgoingCall(room.chatIdBin) || (
            room.type === "group" && !ENABLE_GROUP_CALLING_FLAG
        );

        return (
            <div className={conversationPanelClasses} onMouseMove={self.onMouseMove}
                 data-room-id={self.props.chatRoom.chatId}>
                <div className={"chat-content-block " +
                    (!room.megaChat.chatUIFlags['convPanelCollapse'] ?
                    "with-pane" : "no-pane")}>
                    {!room.megaChat.chatUIFlags['convPanelCollapse'] ? <ConversationRightArea
                        isVisible={this.props.chatRoom.isCurrentlyActive}
                        chatRoom={this.props.chatRoom}
                        members={this.props.chatRoom.members}
                        contacts={self.props.contacts}
                        megaChat={this.props.chatRoom.megaChat}
                        messagesBuff={room.messagesBuff}
                        onAttachFromComputerClicked={function() {
                            self.uploadFromComputer();
                        }}
                        onTruncateClicked={function() {
                            self.setState({'truncateDialog': true});
                        }}
                        onArchiveClicked={function() {
                            self.setState({'archiveDialog': true});
                        }}
                        onUnarchiveClicked={function() {
                            self.setState({'unarchiveDialog': true});
                        }}
                        onRenameClicked={function() {
                            self.setState({
                                'renameDialog': true,
                                'renameDialogValue': self.props.chatRoom.getRoomTitle()
                            });
                        }}
                        onLeaveClicked={function() {
                            room.leave(true);
                        }}
                        onCloseClicked={function() {
                            room.destroy();
                        }}
                        onAttachFromCloudClicked={function() {
                            self.setState({'attachCloudDialog': true});
                        }}
                        onAddParticipantSelected={function(contactHashes) {
                            self.props.chatRoom.scrolledToBottom = true;

                            if (self.props.chatRoom.type == "private") {
                                var megaChat = self.props.chatRoom.megaChat;

                                loadingDialog.show();

                                megaChat.trigger(
                                    'onNewGroupChatRequest',
                                    [
                                        self.props.chatRoom.getParticipantsExceptMe().concat(
                                            contactHashes
                                        )
                                    ]
                                );
                            }
                            else {
                                self.props.chatRoom.trigger('onAddUserRequest', [contactHashes]);
                            }
                        }}
                    /> : null}
                    {
                        room.callManagerCall && room.callManagerCall.isStarted() ?
                            <ConversationAudioVideoPanel
                                chatRoom={this.props.chatRoom}
                                contacts={self.props.contacts}
                                megaChat={this.props.chatRoom.megaChat}
                                unreadCount={this.props.chatRoom.messagesBuff.getUnreadCount()}
                                onMessagesToggle={function(isActive) {
                                    self.setState({
                                        'messagesToggledInCall': isActive
                                    });
                                }}
                            /> : null
                    }

                    {attachCloudDialog}
                    {sendContactDialog}
                    {confirmDeleteDialog}
                    {confirmTruncateDialog}


                    <div className="dropdown body dropdown-arrow down-arrow tooltip not-sent-notification hidden">
                        <i className="dropdown-white-arrow"></i>
                        <div className="dropdown notification-text">
                            <i className="small-icon conversations"></i>
                            {__(l[8882])}
                        </div>
                    </div>

                    <div className=
                            "dropdown body dropdown-arrow down-arrow tooltip not-sent-notification-manual hidden">
                        <i className="dropdown-white-arrow"></i>
                        <div className="dropdown notification-text">
                            <i className="small-icon conversations"></i>
                            {__(l[8883])}
                        </div>
                    </div>

                    <div className=
                            "dropdown body dropdown-arrow down-arrow tooltip not-sent-notification-cancel hidden">
                        <i className="dropdown-white-arrow"></i>
                        <div className="dropdown notification-text">
                            <i className="small-icon conversations"></i>
                            {__(l[8884])}
                        </div>
                    </div>

                    <div className={"chat-topic-block " + (
                        self.props.chatRoom.havePendingGroupCall() || self.props.chatRoom.haveActiveCall() ?
                            " have-pending-group-call" : ""
                    )}>
                        <div className="chat-topic-buttons">
                            <ButtonsUI.Button
                                className="right"
                                disableCheckingVisibility={true}
                                icon={"small-icon " + (
                                    !room.megaChat.chatUIFlags['convPanelCollapse'] ?
                                        "arrow-in-square" :
                                        "arrow-in-square active"
                                )}
                                onClick={function() {
                                    room.megaChat.toggleUIFlag('convPanelCollapse');
                                }}
                            >
                            </ButtonsUI.Button>
                            {!disableStartCalls ? (
                                <span>
                                    <ButtonsUI.Button
                                        className="right"
                                        icon="small-icon video-call colorized"
                                        disabled={room.isReadOnly()}
                                        onClick={function() {
                                            if (!disabledCalls) {
                                                room.startVideoCall();
                                            }
                                        }}
                                    >
                                    </ButtonsUI.Button>
                                    <ButtonsUI.Button
                                        className="right"
                                        icon="small-icon audio-call colorized"
                                        disabled={room.isReadOnly()}
                                        onClick={function() {
                                            if (!disabledCalls) {
                                                room.startAudioCall();
                                            }
                                        }}
                                        >
                                    </ButtonsUI.Button>
                                </span>) : null}
                        </div>
                         {topicInfo}
                    </div>
                    <div className={"messages-block " + additionalClass}>
                        <div className="messages scroll-area">
                            <PerfectScrollbar
                                   onFirstInit={(ps, node) => {
                                        ps.scrollToBottom(true);
                                        self.props.chatRoom.scrolledToBottom = 1;

                                    }}
                                   onReinitialise={self.onMessagesScrollReinitialise}
                                   onUserScroll={self.onMessagesScrollUserScroll}
                                   className="js-messages-scroll-area perfectScrollbarContainer"
                                   messagesToggledInCall={self.state.messagesToggledInCall}
                                   ref={(ref) => self.messagesListScrollable = ref}
                                   chatRoom={self.props.chatRoom}
                                   messagesBuff={self.props.chatRoom.messagesBuff}
                                   editDomElement={self.state.editDomElement}
                                   editingMessageId={self.state.editing}
                                   confirmDeleteDialog={self.state.confirmDeleteDialog}
                                   renderedMessagesCount={messagesList.length}
                                   isLoading={
                                       this.props.chatRoom.messagesBuff.messagesHistoryIsLoading() ||
                                       this.loadingShown
                                   }
                                   options={{
                                       'suppressScrollX': true
                                   }}
                                >
                                <div className="messages main-pad">
                                    <div className="messages content-area">
                                        <div className="loading-spinner js-messages-loading light manual-management"
                                         key="loadingSpinner" style={{top: "50%"}}>
                                            <div className="main-loader" style={{
                                                'position': 'fixed',
                                                'top': '50%',
                                                'left': '50%'
                                            }}></div>
                                        </div>
                                        {/* add a naive pre-pusher that would eventually keep the the scrollbar
                                        realistic */}
                                        {messagesList}
                                    </div>
                                </div>
                            </PerfectScrollbar>
                        </div>
                        {
                            room.state != ChatRoom.STATE.LEFT &&
                            room.havePendingGroupCall() && (
                                !room.callManagerCall ||
                                room.callManagerCall.state !== CallManagerCall.STATE.WAITING_RESPONSE_OUTGOING
                            )    ?
                                <JoinCallNotification chatRoom={room} /> : null
                        }

                        <div className="chat-textarea-block">
                            <WhosTyping chatRoom={room} />

                            <TypingAreaUI.TypingArea
                                chatRoom={self.props.chatRoom}
                                className="main-typing-area"
                                disabled={room.isReadOnly()}
                                persist={true}
                                onUpEditPressed={() => {
                                    var foundMessage = false;
                                    room.messagesBuff.messages.keys().reverse().some(function(k) {
                                        if(!foundMessage) {
                                            var message = room.messagesBuff.messages[k];

                                            var contact;
                                            if (message.userId) {
                                                if (!M.u[message.userId]) {
                                                    // data is still loading!
                                                    return;
                                                }
                                                contact = M.u[message.userId];
                                            }
                                            else {
                                                // contact not found
                                                return;
                                            }

                                            if (
                                                    contact && contact.u === u_handle &&
                                                    (unixtime() - message.delay) < MESSAGE_NOT_EDITABLE_TIMEOUT &&
                                                    !message.requiresManualRetry &&
                                                    !message.deleted &&
                                                    (!message.type ||
                                                         message instanceof Message) &&
                                                    (!message.isManagement || !message.isManagement())
                                                ) {
                                                    foundMessage = message;
                                                    return foundMessage;
                                            }
                                        }
                                    });

                                    if (!foundMessage) {
                                        return false;
                                    }
                                    else {
                                        self.setState({'editing': foundMessage.messageId});
                                        self.props.chatRoom.scrolledToBottom = false;
                                        return true;
                                    }
                                }}
                                onResized={() => {
                                    self.handleWindowResize();
                                    $('.js-messages-scroll-area', self.findDOMNode()).trigger('forceResize', [true]);
                                }}
                                onConfirm={(messageContents) => {
                                    if (messageContents && messageContents.length > 0) {
                                        if (!self.props.chatRoom.scrolledToBottom) {
                                            self.props.chatRoom.scrolledToBottom = true;
                                            self.lastScrollPosition = 0;
                                            // tons of hacks required because of the super weird continuous native
                                            // scroll event under Chrome + OSX, e.g. when the user scrolls up to the
                                            // start of the chat, the event continues to be received event that the
                                            // scrollTop is now 0..and if in that time the user sends a message
                                            // the event triggers a weird "scroll up" animation out of nowhere...
                                            $(self.props.chatRoom).rebind('onMessagesBuffAppend.pull', function() {
                                                self.messagesListScrollable.scrollToBottom(false);
                                                setTimeout(function() {
                                                    self.messagesListScrollable.enable();
                                                }, 1500);
                                            });

                                            self.props.chatRoom.sendMessage(messageContents);
                                            self.messagesListScrollable.disable();
                                            self.messagesListScrollable.scrollToBottom(true);
                                        }
                                        else {
                                            self.props.chatRoom.sendMessage(messageContents);
                                        }
                                    }
                                }}
                            >
                                    <ButtonsUI.Button
                                        className="popup-button left"
                                        icon="small-icon grey-small-plus"
                                        disabled={room.isReadOnly()}
                                        >
                                        <DropdownsUI.Dropdown
                                            className="wide-dropdown attach-to-chat-popup light"
                                            noArrow="true"
                                            positionMy="left top"
                                            positionAt="left bottom"
                                            vertOffset={4}
                                        >
                                            <div className="dropdown info-txt">
                                                {__(l[19793]) ? __(l[19793]) : "Send files from..."}
                                            </div>
                                            <DropdownsUI.DropdownItem
                                                className="link-button light"
                                                icon="grey-cloud colorized"
                                                label={__(l[19794]) ? __(l[19794]) : "My Cloud Drive"}
                                                onClick={(e) => {
                                                    self.setState({'attachCloudDialog': true});
                                            }} />
                                            <DropdownsUI.DropdownItem
                                                className="link-button light"
                                                icon="grey-computer colorized"
                                                label={__(l[19795]) ? __(l[19795]) : "My computer"}
                                                onClick={(e) => {
                                                    self.uploadFromComputer();
                                            }} />
                                            <div className="chat-button-seperator"></div>
                                            <DropdownsUI.DropdownItem
                                                className="link-button light"
                                                icon="square-profile colorized"
                                                label={__(l[8628])}
                                                onClick={(e) => {
                                                    self.setState({'sendContactDialog': true});
                                            }} />
                                        </DropdownsUI.Dropdown>
                                    </ButtonsUI.Button>
                            </TypingAreaUI.TypingArea>

                        </div>
                    </div>
                </div>
            </div>
        );
    }
});

var ConversationPanels = React.createClass({
    mixins: [MegaRenderMixin, RenderDebugger],
    render: function() {
        var self = this;

        var conversations = [];

        var hadLoaded = (
            ChatdIntegration.allChatsHadLoaded.state() !== 'pending' &&
            ChatdIntegration.mcfHasFinishedPromise.state() !== 'pending' &&
            Object.keys(ChatdIntegration._loadingChats).length === 0
        );

        if (hadLoaded && getSitePath() === "/fm/chat") {
            // do we need to "activate" an conversation?
            var activeFound = false;
            self.props.conversations.forEach(function (chatRoom) {
                if (chatRoom.isCurrentlyActive) {
                    activeFound = true;
                }
            });
            if (self.props.conversations.length > 0 && !activeFound) {
                self.props.megaChat.showLastActive();
            }
        }

        hadLoaded && self.props.conversations.forEach(function(chatRoom) {
            var otherParticipants = chatRoom.getParticipantsExceptMe();

            var contact;
            if (otherParticipants && otherParticipants.length > 0) {
                contact = M.u[otherParticipants[0]];
            }

            conversations.push(
                <ConversationPanel
                    chatUIFlags={self.props.chatUIFlags}
                    isExpanded={chatRoom.megaChat.chatUIFlags['convPanelCollapse']}
                    chatRoom={chatRoom}
                    isActive={chatRoom.isCurrentlyActive}
                    messagesBuff={chatRoom.messagesBuff}
                    contacts={M.u}
                    contact={contact}
                    key={chatRoom.roomId + "_" + chatRoom.instanceIndex}
                    />
            );
        });

        if (conversations.length === 0) {
            var contactsList = [];
            var contactsListOffline = [];

            if (hadLoaded) {
                self.props.contacts.forEach(function (contact) {
                    if (contact.u === u_handle) {
                        return;
                    }
                    if(contact.c === 1) {
                        var pres = self.props.megaChat.userPresenceToCssClass(contact.presence);

                        (pres === "offline" ? contactsListOffline : contactsList).push(
                            <ContactsUI.ContactCard contact={contact} megaChat={self.props.megaChat}
                                                    key={contact.u}/>
                        );
                    }
                });
            }
            var emptyMessage = hadLoaded ?
                l[8008] :
                l[7006];

            return (
                <div>
                    <div className="chat-right-area">
                        <div className="chat-right-area contacts-list-scroll">
                            <div className="chat-right-pad">
                                {contactsList}
                                {contactsListOffline}
                            </div>
                        </div>
                    </div>
                    <div className="empty-block">
                        <div className="empty-pad conversations">
                            <div className="empty-icon conversations"></div>
                            <div className="empty-title" dangerouslySetInnerHTML={{
                                __html: __(emptyMessage)
                                    .replace("[P]", "<span>")
                                    .replace("[/P]", "</span>")
                            }}></div>
                        </div>
                    </div>
                </div>
            );
        }
        else {
            return (
                <div className={"conversation-panels " + self.props.className}>
                    {conversations}
                </div>
            );
        }
    }
});



module.exports = {
    ConversationPanel,
    ConversationPanels
};
