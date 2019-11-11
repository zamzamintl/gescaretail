# See LICENSE file for full copyright and licensing details.

{
    'name': 'Pos Conditional Sales',
    'version': '12.0.0.1.1',
    'category': 'Sale/Point Of Sale',
    'sequence': 6,
    'summary': 'Allow discount based on condition',
    'description': """

Allow discount based on condition

    """,
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'depends': [
        'sale_management',
        'base',
        'product',
        'point_of_sale'
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/product_conditional_view.xml',
        'wizard/wizard_assign_product_to_conditional_sale_view.xml',
        'views/templates.xml'
    ],
    'installable': True,
    'auto_install': False,
    'application': True,
}
