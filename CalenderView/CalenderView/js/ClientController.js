

angular.module('demo', ["googleApi"])
    .config(function (googleLoginProvider) {
        googleLoginProvider.configure({
            clientId: '454506114807-dctpuga7pj5ejt8rj5368fd8bko3j6q6.apps.googleusercontent.com',
            scopes: ["https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/plus.login"]
        });
    })
    .controller('DemoCtrl', ['$scope', 'googleLogin', 'googleCalendar', 'googlePlus', function ($scope, googleLogin, googleCalendar, googlePlus) {

        $scope.login = function () {
            googleLogin.login();
        };

        $scope.$on("googlePlus:loaded", function () {

            googlePlus.getCurrentUser().then(function (user) {
                $scope.currentUser = user;
            });
        })
        $scope.currentUser = googleLogin.currentUser;

        $scope.loadEvents = function () {
            this.calendarItems = googleCalendar.listEvents({
                calendarId: this.selectedCalendar.id
            });
        }

        $scope.loadCalendars = function () {
            $scope.calendars = googleCalendar.listCalendars();
        }
    }]);

angular.module('googleApi', [])
    .value('version', '0.1')

    .service("googleApiBuilder", function ($q) {
        this.loadClientCallbacks = [];

        this.build = function (requestBuilder, responseTransformer) {
            return function (args) {
                var deferred = $q.defer();
                var response;
                request = requestBuilder(args);
                request.execute(function (resp, raw) {
                    if (resp.error) {
                        deferred.reject(resp.error);
                    } else {
                        response = responseTransformer ? responseTransformer(resp) : resp;
                        deferred.resolve(response);
                    }

                });
                return deferred.promise;

            }
        };

        this.afterClientLoaded = function (callback) {
            this.loadClientCallbacks.push(callback);
        };

        this.runClientLoadedCallbacks = function () {
            for (var i = 0; i < this.loadClientCallbacks.length; i++) {
                this.loadClientCallbacks[i]();
            }
        };
    })

    .provider('googleLogin', function () {

        this.configure = function (conf) {
            this.config = conf;
        };

        this.$get = function ($q, googleApiBuilder, $rootScope) {
            var config = this.config;
            var deferred = $q.defer();
            return {
                login: function () {
                    gapi.auth.authorize({
                        client_id: config.clientId,
                        scope: config.scopes,
                        immediate: false
                    }, this.handleAuthResult);

                    return deferred.promise;
                },

                handleClientLoad: function () {
                    var self = this;
                    gapi.auth.init(function () { });
                    window.setTimeout(self.checkAuth, 1);
                },

                checkAuth: function () {
                    gapi.auth.authorize({
                        client_id: config.clientId,
                        scope: config.scopes,
                        immediate: true
                    }, this.handleAuthResult);
                },

                handleAuthResult: function (authResult) {
                    if (authResult && !authResult.error) {
                        var data = {};
                        $rootScope.$broadcast("google:authenticated", authResult);
                        googleApiBuilder.runClientLoadedCallbacks();

                        // here you will store the auth_token
                        window.localStorage.setItem('auth_token', authResult.token /*I don't know what this response looks like, but it should be similar to this*/);

                        deferred.resolve(data);
                    } else {
                        deferred.reject(authResult.error);
                    }
                },
            }
        };


    })

    .service("googleCalendar", function (googleApiBuilder, $rootScope) {

        var self = this;
        var itemExtractor = function (resp) {
            return resp.items;
        };

        googleApiBuilder.afterClientLoaded(function () {
            gapi.client.load('calendar', 'v3', function () {
                debugger;
                self.listEvents = googleApiBuilder.build(gapi.client.calendar.events.list, itemExtractor);
                self.listCalendars = googleApiBuilder.build(gapi.client.calendar.calendarList.list, itemExtractor);
                self.createEvent = googleApiBuilder.build(gapi.client.calendar.events.insert);

                $rootScope.$broadcast("googleCalendar:loaded")
            });

        });

    })

    .service("googlePlus", function (googleApiBuilder, $rootScope) {

        var self = this;
        var itemExtractor = function (resp) {
            return resp.items;
        };

        googleApiBuilder.afterClientLoaded(function () {
            gapi.client.load('plus', 'v1', function () {
                self.getPeople = googleApiBuilder.build(gapi.client.plus.people.get);
                self.getCurrentUser = function () {
                    return self.getPeople({
                        userId: "me"
                    });
                }
                $rootScope.$broadcast("googlePlus:loaded")
            });

        });

    })