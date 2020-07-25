import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('There is no customer with the provided id.');
    }

    const orderProducts = await this.productsRepository.findAllById(products);

    const orderProductsId = orderProducts.map(product => product.id);

    const invalidProducts = products.filter(
      product => !orderProductsId.includes(product.id),
    );

    if (invalidProducts.length) {
      throw new AppError(
        `There is no product with the provided id "${invalidProducts[0].id}".`,
      );
    }

    const productsWithNoAvailableQuantity = products.filter(
      product =>
        orderProducts.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    if (productsWithNoAvailableQuantity.length) {
      throw new AppError(
        `The requested quantity for product with id "${productsWithNoAvailableQuantity[0].id}" is not available.`,
      );
    }

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: orderProducts.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer,
      products: serializedProducts,
    });

    return order;
  }
}

export default CreateOrderService;
