# See LICENSE file for full copyright and licensing details.

{
    'name': 'Point of Sale Helper module',
    'version': '12.0.0.0.1',
    'category': 'accounting',
    'summary': 'point of sale usability customizations',
    'description': 'point of sale usability customizations',
    'author': 'Accomodata',
    'website': 'www.accomodata.be',
    'depends': [
        'base',
        'point_of_sale',
    ],
    'data': [
        'views/point_of_sale_dashboard.xml',
        'views/point_of_sale_session.xml'
    ],
    'qweb': [],
    'demo': [],
    'installable': True,
    'application': False,
    'auto_install': False,
    'images': [],
}
