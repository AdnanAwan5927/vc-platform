angular.module('platformWebApp')
.factory('platformWebApp.authService', ['$http', '$rootScope', '$cookieStore', '$state', '$interpolate', '$q', 'platformWebApp.authDataStorage', function ($http, $rootScope, $cookieStore, $state, $interpolate, $q, authDataStorage) {
    var serviceBase = 'api/platform/security/';
    var authContext = {
        userId: null,
        userLogin: null,
        fullName: null,
        permissions: null,
        isAuthenticated: false
    };

    authContext.fillAuthData = function () {
        // TODO: check authDataStorage for authenticationData?

        return $http.get(serviceBase + 'currentuser').then(
            function (results) {
                changeAuth(results.data);
            },
            function (error) { });
    };

    authContext.login = function (email, password, remember) {
        var requestData = 'grant_type=password&username=' + email + '&password=' + password;

        var deferred = $q.defer();

        $http.post('token', requestData, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }).then(
            function (response) {
                authDataStorage.storeAuthData(response.data.access_token, email, response.data.refresh_token);

                return authContext.fillAuthData().then(function() {
                    promise.resolve(response.data);
                }, function(error) {
                    promise.reject(error);
                })
            }, function(error) {
                authContext.logout();
                promise.reject(error);
            });

        return deferred.promise;

        // TODO: remove this obsolete code
        //return $http.post(serviceBase + 'login/', { userName: email, password: password, rememberMe: remember }).then(
        //    function (results) {
        //        changeAuth(results.data);
        //        return authContext.isAuthenticated;
        //    });
    };

    authContext.refreshToken = function() {
        var deferred = $q.defer();

        var authData = authDataStorage.getStoredData();
        if (authData) {
            var data = 'grant_type=refresh_token&refresh_token=' + authData.refreshToken;

            authDataStorage.clearStoredData();

            $http.post('token', data, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }).success(function (response) {
                authDataStorage.storeAuthData(response.access_token, response.userName, response.refresh_token);
                deferred.resolve(response);
            }).error(function (err) {
                authContext.logout();
                deferred.reject(err);
            });
        } else {
            deferred.reject();
        }

        return deferred.promise;
    };

    authContext.requestpasswordreset = function (data) {
        return $http.post(serviceBase + 'users/' + data.userName + '/requestpasswordreset/').then(
            function (results) {
                return results.data;
            });
    };

    authContext.validatepasswordresettoken = function (data) {
        return $http.post(serviceBase + 'users/' + data.userId + '/validatepasswordresettoken', { token: data.code }).then(
            function (results) {
                return results.data;
            });
    };

    authContext.resetpassword = function (data) {
        return $http.post(serviceBase + 'users/' + data.userId + '/resetpasswordconfirm', { token: data.code, newPassword: data.newPassword }).then(
            function (results) {
                return results.data;
            });
    };

    authContext.logout = function () {
        authDataStorage.clearStoredData();
        changeAuth({});

        // TODO: remove this obsolete code
        //$http.post(serviceBase + 'logout/').then(function (result) {
        //});
    };

    authContext.checkPermission = function (permission, securityScopes) {
        //first check admin permission
        // var hasPermission = $.inArray('admin', authContext.permissions) > -1;
        var hasPermission = authContext.isAdministrator;
        if (!hasPermission && permission) {
            permission = permission.trim();
            //first check global permissions
            hasPermission = $.inArray(permission, authContext.permissions) > -1;
            if (!hasPermission && securityScopes) {
                if (typeof securityScopes === 'string' || angular.isArray(securityScopes)) {
                    securityScopes = angular.isArray(securityScopes) ? securityScopes : securityScopes.split(',');
                    //Check permissions in scope
                    hasPermission = _.some(securityScopes, function (x) {
                        var permissionWithScope = permission + ":" + x;
                        var retVal = $.inArray(permissionWithScope, authContext.permissions) > -1;
                        //console.log(permissionWithScope + "=" + retVal);
                        return retVal;
                    });
                }
            }
        }
        return hasPermission;
    };

    function changeAuth(user) {
        angular.extend(authContext, user);    
        authContext.userLogin = user.userName;
        authContext.fullName = user.userLogin;
        authContext.isAuthenticated = user.userName != null;       

        //Interpolate permissions to replace some template to real value
        if (authContext.permissions) {
            authContext.permissions = _.map(authContext.permissions, function (x) {
                return $interpolate(x)(authContext);
            });
        }
        $rootScope.$broadcast('loginStatusChanged', authContext);
    }
    return authContext;
}]);
