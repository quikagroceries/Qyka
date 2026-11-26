"""Banks people can withdraw to (Paystack bank codes)."""

BANKS: list[tuple[str, str]] = [
    ("044", "Access Bank"),
    ("063", "Access Bank (Diamond)"),
    ("050", "Ecobank Nigeria"),
    ("070", "Fidelity Bank"),
    ("011", "First Bank of Nigeria"),
    ("214", "First City Monument Bank"),
    ("058", "Guaranty Trust Bank"),
    ("030", "Heritage Bank"),
    ("301", "Jaiz Bank"),
    ("082", "Keystone Bank"),
    ("50211", "Kuda Bank"),
    ("999992", "OPay"),
    ("526", "Parallex Bank"),
    ("999991", "PalmPay"),
    ("076", "Polaris Bank"),
    ("101", "Providus Bank"),
    ("221", "Stanbic IBTC Bank"),
    ("068", "Standard Chartered Bank"),
    ("232", "Sterling Bank"),
    ("100", "Suntrust Bank"),
    ("032", "Union Bank of Nigeria"),
    ("033", "United Bank for Africa"),
    ("215", "Unity Bank"),
    ("035", "Wema Bank"),
    ("057", "Zenith Bank"),
    ("50515", "Moniepoint MFB"),
]

BY_CODE = dict(BANKS)
