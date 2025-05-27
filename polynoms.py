class Polynomial:
    def __init__(self, *coefficients):
        """
        Initialize the polynomial.
        Coefficients are given in the order [c0, c1, c2, ...],
        where the polynomial has the form c0*x^0 + c1*x^1 + c2*x^2 + ...
        """
        self.coefficients = coefficients

    def calc(self, x):
        return sum(c * (x ** i) for i, c in enumerate(self.coefficients))

    def __str__(self):
        return f"Polynomial with coeffs: {self.coefficients}"