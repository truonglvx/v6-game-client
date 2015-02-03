define(['modules/game_manager', 'modules/invite_manager', 'modules/user_list', 'modules/socket', 'modules/views_manager', 'modules/chat_manager', 'EE'],
function(GameManager, InviteManager, UserList, Socket, ViewsManager, ChatManager, EE) {
    'use strict';
    var Client = function(opts) {
        opts.resultDialogDelay = opts.resultDialogDelay || 0;
        opts.modes = opts.modes || opts.gameModes || ['default'];
        opts.reload = opts.reload || false;
        opts.turnTime = opts.turnTime || 60;

        try{
            this.isAdmin = opts.isAdmin || LogicGame.isSuperUser();
        }catch (e){
            this.isAdmin = false;
            console.error(e);
        }

        var self = this;

        this.opts = opts;
        this.game = opts.game || 'test';
        this.userList = new UserList(this);
        this.gameManager = new GameManager(this);
        this.inviteManager = new InviteManager(this);
        this.chatManager = new ChatManager(this);
        this.viewsManager = new ViewsManager(this);

        this.socket = new Socket(opts);
        this.socket.on("connection", function () {
            console.log('client;', 'socket connected');
        });

        this.socket.on("disconnection", function() {
            console.log('client;', 'socket disconnected');
            self.emit('disconnected');
        });

        this.socket.on("failed", function() {
            console.log('client;', 'socket connection failed');
            self.emit('disconnected');
        });

        this.socket.on("message", function(message) {
            console.log('client;', "socket message", message);
            self.onMessage(message);
        });

        this.getUser = this.userList.getUser.bind(this.userList);
    };

    Client.prototype  = new EE();

    Client.prototype.init = function(){
        this.socket.init();
        this.viewsManager.init();
        return this;
    };


    Client.prototype.onMessage = function(message){
        switch (message.module){
            case 'server': this.onServerMessage(message); break;
            case 'invite_manager': this.inviteManager.onMessage(message); break;
            case 'game_manager': this.gameManager.onMessage(message); break;
            case 'chat_manager':this.chatManager.onMessage(message); break;
        }
    };


    Client.prototype.onServerMessage = function(message){
        switch (message.type){
            case 'login':
                this.onLogin(message.data.you, message.data.userlist, message.data.rooms);
                break;
            case 'user_login':
                this.userList.onUserLogin(message.data);
                break;
            case 'user_leave':
                this.userList.onUserLeave(message.data);
                break;
            case 'new_game':
                this.userList.onGameStart(message.data.room, message.data.players);
                this.gameManager.onMessage(message);
                break;
            case 'end_game':
                this.userList.onGameEnd(message.data.room, message.data.players);
                break;
            case 'error':
                this.onError(message.data);
                break;
        }
    };

    Client.prototype.onLogin = function(user, userlist, rooms){
        console.log('client;', 'login', user, userlist, rooms);
        var i;
        for (i = 0; i < userlist.length; i++) this.userList.onUserLogin(userlist[i]);
        for (i = 0; i< rooms.length; i++) this.userList.onGameStart(rooms[i].room, rooms[i].players);
        this.emit('login', user);
    };


    Client.prototype.send = function (module, type, target, data) {
        if (typeof module == "object" && module.module && module.type && module.data) {
            type = module.type;
            data = module.data;
            target = module.target;
            module = module.module;
        }
        if (!module || !type || !data || !target){
            console.warn('client;', "some arguments undefined!", module, type, target, data);
            return;
        }
        if (target != 'server'){
            if (!this.userList.getUser(target)) console.warn('client;', 'send message to offline user!', target);
        }
        this.socket.send({
            module:module,
            type:type,
            target:target,
            data:data
        });
    };

    Client.prototype.onError = function (error) {
        console.error('client;', 'server error', error);
        if (error == 'login_error') {
            this.emit('login_error');
            this.socket.ws.close();
        }
    };


    Client.prototype.onShowProfile = function(userId, userName){
        if (!userName) {
            var user = this.userList.getUser(userId);
            if (!user) return;
            userName = user.userName;
        }
        this.emit('show_profile', {userId:userId, userName:userName});
    };


    Client.prototype.getPlayer = function(){
        return this.userList.player;
    };

    return Client;
});