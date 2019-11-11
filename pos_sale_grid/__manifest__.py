# See LICENSE file for full copyright and licensing details.

{
    'name': 'POS Sale Grid',
    'version': '12.0.0.1.2',
    'category': 'Point Of Sale',
    'sequence': 6,
    'summary': 'Pos Sale Grid',
    'description': """

Pos Sale Grid

    """,
    'author': 'Accomodata',
    'maintainer': 'Accomodata',
    'website': 'https://www.accomodata.be',
    'depends': [
        'base',
        'product',
        'sale',
        'product_attribute_type',
        'pos_addons',
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/product_template.xml',
        'views/crm_team.xml',
        'report/sale_grid.xml'
    ],
    'installable': True,
    'auto_install': False,
    'application': False,
}
