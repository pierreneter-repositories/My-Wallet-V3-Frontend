angular
  .module('walletApp')
  .controller('BuyCtrl', BuyCtrl);

function BuyCtrl ($scope, MyWallet, Wallet, $stateParams, Alerts, currency, $uibModalInstance, $uibModal, country, $interval, exchange) {
  $scope.fiatCurrency = Wallet.settings.currency;
  $scope.btcCurrency = Wallet.settings.btcCurrency;
  $scope.currencies = currency.currencies;
  $scope.profile = MyWallet.wallet.profile;
  $scope.settings = Wallet.settings;
  $scope.countries = country;
  $scope.user = Wallet.user;
  $scope.exchange = exchange;
  $scope.method = undefined;
  $scope.status = {};
  $scope.step = 0;

  $scope.fields = { email: $scope.user.email };
  $scope.bank = { name: 'Bank Account', fee: 0 };
  $scope.creditcard = { name: 'Credit Card', fee: 2.75 };
  $scope.method = $scope.creditcard;
  $scope.transaction = {fiat: 0, btc: 0, fee: 0, total: 0};

  $scope.fetchProfile = () => {
    $scope.status.waiting = true;

    const success = (msg) => {
      $scope.status = {};
      $scope.nextStep();
    };

    const error = () => { $scope.status = {}; };

    return $scope.exchange.fetchProfile().then(success, error);
  };

  $scope.updateAmounts = () => {
    if (!$scope.exchange.profile) return;
    let fiatAmt = $scope.transaction.fiat;
    let feePercentage = $scope.exchange.profile.level.feePercentage;
    let methodFee = fiatAmt * ($scope.method.fee / 100);
    let tradingFee = fiatAmt * (feePercentage / 100);

    $scope.transaction.tradingFee = tradingFee.toFixed(2);
    $scope.transaction.methodFee = methodFee.toFixed(2);
    $scope.transaction.btc = currency.formatCurrencyForView($scope.quote.quoteAmount / 10000, currency.bitCurrencies[0]);
    $scope.transaction.total = fiatAmt +
                               +$scope.transaction.methodFee +
                               +$scope.transaction.tradingFee;
  };

  // $scope.verifyConfirmationCode = (code, successCallback, errorCallback) => {
  //   const success = () => {
  //     $scope.user.isEmailVerified = true;
  //     successCallback();
  //     $scope.nextStep();
  //   };

  //   const error = (err) => Alerts.displayError(err); errorCallback();

  //   Wallet.verifyEmail($scope.confirmationCode.bcAsyncForm.input.$viewValue, success, error);
  // };

  $scope.getQuote = () => {
    if (!$scope.exchange.profile) return;
    $scope.transaction.btc = 0;
    $scope.quote = null;

    let amt = $scope.transaction.fiat * 100;
    let curr = $scope.fiatCurrency.code;
    if (!amt) return;

    const success = (quote) => {
      $scope.quote = quote;
      $scope.updateAmounts();
    };

    const error = (err) => {
      Alerts.displayError(err);
    };

    $scope.exchange.getQuote(amt, curr).then(success, error);
  };

  $scope.toggleEmail = () => $scope.editEmail = !$scope.editEmail;

  $scope.addExchange = () => {
    if (!$scope.profile.countryCode) return;
    if (!MyWallet.wallet.external.coinify) MyWallet.wallet.external.addCoinify();
    $scope.exchange = MyWallet.wallet.external.coinify;
    $scope.partner = 'Coinify';
  };

  $scope.nextStep = () => {
    if (!$scope.transaction.fiat) {
      $scope.step = 0;
    } else if (!$scope.profile.countryCode) {
      $scope.step = 1;
    } else if (!$scope.user.isEmailVerified) {
      $scope.step = 2;
      $scope.addExchange();
    } else if ($scope.rejectedEmail) {
      $scope.step = 2;
    } else if (!$scope.exchange.profile) {
      $scope.step = 3;
      $scope.fetchProfile();
    } else {
      $scope.step = 4;
    }
  };

  $scope.prevStep = () => {
    if ($scope.step > 0) {
      if ($scope.exchange.profile) $scope.step = 0;
      else $scope.step--;
    }
  };

  $scope.isDisabled = () => {
    if ($scope.step === 0) {
      return !($scope.transaction.fiat > 0);
    } else if ($scope.step === 1) {
      return !$scope.profile.countryCode;
    } else if ($scope.step === 3) {
      return !$scope.signupForm.$valid;
    }
  };

  $scope.changeEmail = (email, successCallback, errorCallback) => {
    const success = () => $scope.editEmail = false; successCallback();
    const error = () => $scope.editEmail = false; errorCallback();

    $scope.rejectedEmail = undefined;

    Wallet.changeEmail(email, success, error);
  };

  $scope.signup = () => {
    $scope.status.waiting = true;

    const success = () => {
      $scope.status = {};
      $scope.fetchProfile().then($scope.getQuote);
    };

    const error = (err) => {
      $scope.status = {};

      try {
        let e = JSON.parse(err);
        $scope.rejectedEmail = e.error === 'email_address_in_use' ? true : undefined;
      } catch (e) {
        Alerts.displayError(err);
      }
    };

    $scope.exchange.signup()
      .then(success).catch(error);
  };

  $scope.buy = () => {
    $scope.status.waiting = true;

    const success = (trade) => {
      $scope.status = {};

      let iSignThisProps = {
        trade: trade,
        method: $scope.method,
        partner: $scope.partner,
        transaction: $scope.transaction,
        currencySymbol: $scope.currencySymbol
      };

      $uibModal.open({
        templateUrl: 'partials/isignthis-modal.jade',
        backdrop: 'static',
        controller: 'iSignThisCtrl',
        windowClass: 'bc-modal coinify',
        resolve: { iSignThisProps: iSignThisProps }
      });
    };

    const error = (err) => {
      $scope.status = {};
      Alerts.displayError(err);
    };

    $scope.exchange.buy($scope.transaction.fiat).then(success, error);
  };

  $scope.cancel = () => $uibModalInstance.dismiss('');
  $scope.close = () => Alerts.confirm('ARE_YOU_SURE_CANCEL', {}, '', 'IM_DONE').then($scope.cancel);

  $scope.changeCurrency = (curr) => {
    const error = () => { };
    const success = () => { $scope.fiatCurrency = curr; };

    Wallet.changeCurrency(curr).then(success, error);
  };

  $scope.isCurrencySelected = (currency) => currency === $scope.fiatCurrency;

  $scope.$watch('method', $scope.updateAmounts);

  $scope.addExchange();

  $scope.$watch('user.isEmailVerified', (newVal) => {
    $scope.user.isEmailVerified = newVal;
    $scope.nextStep();
  });

  $scope.$watch('fiatCurrency', () => {
    let curr = $scope.fiatCurrency || null;
    $scope.currencySymbol = currency.conversions[curr.code];
  });
}