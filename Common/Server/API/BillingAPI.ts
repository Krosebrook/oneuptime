import { IsBillingEnabled } from "../EnvironmentConfig";
import UserMiddleware from "../Middleware/UserAuthorization";
import BillingService from "../Services/BillingService";
import ProjectService from "../Services/ProjectService";
import Express, {
  ExpressRequest,
  ExpressResponse,
  ExpressRouter,
  NextFunction,
  OneUptimeRequest,
} from "../Utils/Express";
import Response from "../Utils/Response";
import BadDataException from "../../Types/Exception/BadDataException";
import Permission, { UserPermission } from "../../Types/Permission";
import Project from "../../Models/DatabaseModels/Project";
import CommonAPI from "./CommonAPI";
import ObjectID from "../../Types/ObjectID";
import DatabaseCommonInteractionProps from "../../Types/BaseDatabase/DatabaseCommonInteractionProps";

export default class BillingAPI {
  public router: ExpressRouter;

  public constructor() {
    this.router = Express.getRouter();

    this.router.get(
      `/billing/customer-balance`,
      UserMiddleware.getUserMiddleware,
      async (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
        try {
          if (!IsBillingEnabled) {
            throw new BadDataException(
              "Billing is not enabled for this server",
            );
          }

          const userPermissions: Array<UserPermission> = (
            await this.getPermissionsForTenant(req)
          ).filter((permission: UserPermission) => {
            return (
              permission.permission.toString() ===
                Permission.ProjectOwner.toString() ||
              permission.permission.toString() ===
                Permission.ManageProjectBilling.toString()
            );
          });

          if (
            userPermissions.length === 0 &&
            !(req as OneUptimeRequest).userAuthorization?.isMasterAdmin
          ) {
            throw new BadDataException(
              `You need ${Permission.ProjectOwner} or ${Permission.ManageProjectBilling} permission to view billing balance.`,
            );
          }

          const project: Project | null = await ProjectService.findOneById({
            id: this.getTenantId(req)!,
            props: {
              isRoot: true,
            },
            select: {
              _id: true,
              paymentProviderCustomerId: true,
            },
          });

          if (!project) {
            throw new BadDataException("Project not found");
          }

          if (!project.paymentProviderCustomerId) {
            throw new BadDataException("Payment Provider customer not found");
          }

          const balance: number = await BillingService.getCustomerBalance(
            project.paymentProviderCustomerId,
          );

          return Response.sendJsonObjectResponse(req, res, {
            balance: balance,
          });
        } catch (err) {
          next(err);
        }
      },
    );
  }

  public async getPermissionsForTenant(
    req: ExpressRequest,
  ): Promise<Array<UserPermission>> {
    const permissions: Array<UserPermission> = [];

    const props: DatabaseCommonInteractionProps =
      await CommonAPI.getDatabaseCommonInteractionProps(req);

    if (
      props &&
      props.userTenantAccessPermission &&
      props.userTenantAccessPermission[props.tenantId?.toString() || ""]
    ) {
      return (
        props.userTenantAccessPermission[props.tenantId?.toString() || ""]
          ?.permissions || []
      );
    }

    return permissions;
  }

  public getTenantId(req: ExpressRequest): ObjectID | null {
    if ((req as OneUptimeRequest).tenantId) {
      return (req as OneUptimeRequest).tenantId as ObjectID;
    }

    return null;
  }

  public getRouter(): ExpressRouter {
    return this.router;
  }
}
